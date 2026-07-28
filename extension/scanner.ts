import * as vscode from 'vscode';
import fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage, ErroredFile, SecurityDetail } from '../shared/messages';
import { ASTParser } from './parser';
import { DuplicateDetector } from './duplicates';
import { SecretScanner } from './security/secrets';
import { VulnerabilityScanner } from './security/vulnerabilities';

// Executable code files — run complexity, duplicates, secrets
const EXECUTABLE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
    '.vue', '.svelte', '.sh', '.bash', '.bat', '.ps1', '.sql', '.r'
]);

// Data/config files — count them but DON'T run complexity/duplicates
const DATA_EXTENSIONS = new Set([
    '.json', '.yaml', '.yml', '.toml', '.xml', '.md', '.txt',
    '.html', '.css', '.scss', '.less', '.env', '.ini', '.cfg'
]);

function isCodeFile(ext: string, filename: string): boolean {
    if (filename.startsWith('.env')) return true;
    return EXECUTABLE_EXTENSIONS.has(ext) || DATA_EXTENSIONS.has(ext);
}

const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB
const BATCH_SIZE = 10;

export class WorkspaceScanner {
    private parser: ASTParser;
    private decoder = new TextDecoder('utf-8');

    constructor(private workspaceRoot: string) {
        this.parser = new ASTParser();
    }

    async scan(): Promise<HostMessage> {
        try {
            const config = await loadConfig(this.workspaceRoot);
            
            const ig = ignore().add([
                '.git', 'node_modules', 'dist', 'venv', '.venv', 
                'webview-ui', '__pycache__', '.next', '.nuxt',
                'build', 'coverage', '.tox', '.mypy_cache',
                ...config.ignore
            ]);

            const entries = await fg(['**/*'], { 
                cwd: this.workspaceRoot, 
                onlyFiles: true,
                dot: true, // Allow .env and hidden config files while ignoring .git/.venv
                ignore: [
                    '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', 
                    '**/.venv/**', '**/venv/**', '**/webview-ui/**', '**/__pycache__/**',
                    '**/*.lock', '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml',
                    '**/.next/**', '**/.nuxt/**', '**/coverage/**', '**/.tox/**',
                    '**/.mypy_cache/**', '**/*.pyc', '**/*.pyo',
                    ...config.ignore
                ]
            });

            const allFiles = entries.map(f => f.replace(/\\/g, '/')).filter(f => !ig.ignores(f));

            // Pre-filter code files
            const codeFiles: string[] = [];
            for (const f of allFiles) {
                const filename = f.split('/').pop() || '';
                const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '');
                if (isCodeFile(ext, filename)) {
                    codeFiles.push(f);
                }
            }

            const duplicateDetector = new DuplicateDetector();
            const secretScanner = new SecretScanner();
            const erroredFiles: ErroredFile[] = [];
            const securityDetails: SecurityDetail[] = [];
            let totalSecurityRisks = 0;
            let totalComplexBlocks = 0;
            let analyzedCount = 0;
            let failCount = 0;
            let pkgJsonContent: string | undefined;
            let reqTxtContent: string | undefined;

            for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
                await new Promise(resolve => setTimeout(resolve, 0));

                const batch = codeFiles.slice(i, i + BATCH_SIZE);

                const results = await Promise.allSettled(batch.map(async f => {
                    const normalizedFile = f.replace(/\\/g, '/');
                    const filename = normalizedFile.split('/').pop() || '';
                    const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '');
                    const uri = vscode.Uri.file(`${this.workspaceRoot}/${normalizedFile}`);
                    
                    // Check IDE diagnostics for errors
                    const diagnostics = vscode.languages.getDiagnostics(uri);
                    const fileErrors = diagnostics
                        .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                        .map(d => `Line ${d.range.start.line + 1}: ${d.message}`);

                    if (fileErrors.length > 0) {
                        erroredFiles.push({ file: normalizedFile, errors: fileErrors });
                        return { analyzed: true, failed: true, complexity: 0 };
                    }

                    // Stat check
                    let stat;
                    try {
                        stat = await vscode.workspace.fs.stat(uri);
                    } catch {
                        return { analyzed: false, failed: false, complexity: 0 };
                    }
                    if (stat.size > MAX_FILE_SIZE_BYTES) {
                        return { analyzed: false, failed: false, complexity: 0 };
                    }

                    // Read file content
                    const fileData = await vscode.workspace.fs.readFile(uri);
                    let fileContent = this.decoder.decode(fileData);

                    // Track manifests
                    if (filename === 'package.json' && !normalizedFile.includes('node_modules')) {
                        pkgJsonContent = fileContent;
                    }
                    if (filename === 'requirements.txt') {
                        reqTxtContent = fileContent;
                    }

                    // Secret scan — includes .env files and code files
                    const isEnv = filename.startsWith('.env');
                    if (isEnv || EXECUTABLE_EXTENSIONS.has(ext)) {
                        const secrets = secretScanner.scanFile(normalizedFile, fileContent);
                        if (secrets.length > 0) {
                            for (const s of secrets) {
                                securityDetails.push({ file: s.filePath, line: s.line, type: s.patternName });
                            }
                            totalSecurityRisks += secrets.length;
                        }
                    }

                    // Complexity analysis — only executable code
                    let complexity = 0;
                    if (EXECUTABLE_EXTENSIONS.has(ext)) {
                        complexity = this.parser.analyzeComplexity(normalizedFile, fileContent);

                        if (fileContent.length > 200) {
                            duplicateDetector.addFile(normalizedFile, fileContent);
                        }
                    } else if (ext === '.json') {
                        try { JSON.parse(fileContent); } catch {
                            erroredFiles.push({ file: normalizedFile, errors: ['Invalid JSON syntax'] });
                            return { analyzed: true, failed: true, complexity: 0 };
                        }
                    }

                    fileContent = '';

                    return { analyzed: true, failed: false, complexity };
                }));

                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        const val = r.value;
                        if (val.analyzed) {
                            analyzedCount++;
                            if (val.failed) failCount++;
                            totalComplexBlocks += val.complexity;
                        }
                    }
                }
            }

            const dupResult = duplicateDetector.findDuplicates(0.75);

            const vulnerabilityScanner = new VulnerabilityScanner();
            const totalVulnerabilities = await vulnerabilityScanner.scanDependencies(pkgJsonContent, reqTxtContent);

            let effortTier: 'Low' | 'Medium' | 'High' = 'Low';
            if (totalComplexBlocks >= 50 || dupResult.duplicateCount >= 5 || totalSecurityRisks >= 3 || totalVulnerabilities >= 5) {
                effortTier = 'High';
            } else if (totalComplexBlocks >= 10 || dupResult.duplicateCount >= 1 || totalSecurityRisks >= 1 || totalVulnerabilities >= 1) {
                effortTier = 'Medium';
            }

            return {
                type: 'scanComplete',
                payload: {
                    totalFiles: allFiles.length,
                    codeFiles: codeFiles.length,
                    analyzedFiles: analyzedCount,
                    failedFiles: failCount,
                    complexBlocks: totalComplexBlocks,
                    duplicateBlocks: dupResult.duplicateCount,
                    securityRisks: totalSecurityRisks,
                    vulnerabilities: totalVulnerabilities,
                    effortTier,
                    message: 'Scan completed successfully',
                    erroredFiles,
                    duplicatePairs: dupResult.duplicatePairs.map(([a, b]) => ({ fileA: a, fileB: b, similarity: 0.75 })),
                    securityDetails: securityDetails.slice(0, 30)
                }
            };
        } catch (error) {
            console.error('Scan error:', error);
            return {
                type: 'scanFailed',
                payload: { fileCount: 0, failedCount: 0 }
            };
        }
    }

    public async getFileContent(filePath: string): Promise<string> {
        const normalized = filePath.replace(/\\/g, '/');
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${normalized}`);
        const data = await vscode.workspace.fs.readFile(uri);
        return this.decoder.decode(data);
    }
}
