import * as vscode from 'vscode';
import fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage, ErroredFile, SecurityDetail } from '../shared/messages';
import { ASTParser } from './parser';
import { DuplicateDetector } from './duplicates';
import { SecretScanner } from './security/secrets';
import { VulnerabilityScanner } from './security/vulnerabilities';

// Only analyze code files — skip binaries, images, lock files
const CODE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.less', '.vue', '.svelte',
    '.json', '.yaml', '.yml', '.toml', '.xml', '.md', '.txt',
    '.sh', '.bash', '.bat', '.ps1', '.sql', '.r', '.env'
]);

const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256 KB — skip huge files
const BATCH_SIZE = 20; // Process 20 files at a time, not 511 at once

export class WorkspaceScanner {
    private parser: ASTParser;

    constructor(private workspaceRoot: string) {
        this.parser = new ASTParser();
    }

    async scan(): Promise<HostMessage> {
        try {
            const config = await loadConfig(this.workspaceRoot);
            
            const ig = ignore().add(['.git', 'node_modules', 'dist', 'venv', 'webview-ui', ...config.ignore]);

            const entries = await fg(['**/*'], { 
                cwd: this.workspaceRoot, 
                onlyFiles: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.venv/**', '**/webview-ui/**', '**/*.lock', '**/package-lock.json', ...config.ignore]
            });

            const filesToScan = entries.filter(f => !ig.ignores(f));

            // ── Collectors ──────────────────────────────────
            const duplicateDetector = new DuplicateDetector();
            const secretScanner = new SecretScanner();
            const erroredFiles: ErroredFile[] = [];
            const securityDetails: SecurityDetail[] = [];
            let totalSecurityRisks = 0;
            let totalComplexBlocks = 0;
            let successCount = 0;
            let failCount = 0;
            let pkgJsonContent: string | undefined;
            let reqTxtContent: string | undefined;

            // ── Process in batches of 20 to avoid memory flood ───
            for (let i = 0; i < filesToScan.length; i += BATCH_SIZE) {
                const batch = filesToScan.slice(i, i + BATCH_SIZE);

                const results = await Promise.allSettled(batch.map(async f => {
                    // Check file extension — skip non-code files
                    const ext = '.' + f.split('.').pop()?.toLowerCase();
                    if (!CODE_EXTENSIONS.has(ext)) {
                        return 0; // Skip but count as success
                    }

                    const uri = vscode.Uri.file(`${this.workspaceRoot}/${f}`);
                    
                    // Check IDE diagnostics for errors
                    const diagnostics = vscode.languages.getDiagnostics(uri);
                    const fileErrors = diagnostics
                        .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                        .map(d => `Line ${d.range.start.line + 1}: ${d.message}`);

                    if (fileErrors.length > 0) {
                        erroredFiles.push({ file: f, errors: fileErrors });
                        throw new Error(`${fileErrors.length} error(s) detected`);
                    }

                    // Check file size before reading
                    let stat;
                    try {
                        stat = await vscode.workspace.fs.stat(uri);
                    } catch {
                        return 0;
                    }
                    if (stat.size > MAX_FILE_SIZE_BYTES) {
                        return 0; // Skip huge files
                    }

                    const fileData = await vscode.workspace.fs.readFile(uri);
                    const fileContent = Buffer.from(fileData).toString('utf8');

                    // Track manifests
                    if (f.endsWith('package.json') && !f.includes('node_modules')) pkgJsonContent = fileContent;
                    if (f.endsWith('requirements.txt')) reqTxtContent = fileContent;

                    // Secret scan
                    const secrets = secretScanner.scanFile(f, fileContent);
                    if (secrets.length > 0) {
                        for (const s of secrets) {
                            securityDetails.push({ file: s.filePath, line: s.line, type: s.patternName });
                        }
                        totalSecurityRisks += secrets.length;
                    }

                    // Duplicate detection (only for code files with enough content)
                    if (fileContent.length > 100) {
                        duplicateDetector.addFile(f, fileContent);
                    }

                    return this.parser.analyzeComplexity(f, fileContent);
                }));

                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        totalComplexBlocks += r.value;
                        successCount++;
                    } else {
                        failCount++;
                    }
                }
            }

            // Duplicate detection — limit comparisons for large projects
            const dupResult = duplicateDetector.findDuplicates(0.75);

            // Vulnerability scan (cached — fast)
            const vulnerabilityScanner = new VulnerabilityScanner();
            const totalVulnerabilities = await vulnerabilityScanner.scanDependencies(pkgJsonContent, reqTxtContent);

            // Effort Tier
            let effortTier: 'Low' | 'Medium' | 'High' = 'Low';
            if (totalComplexBlocks >= 6 || dupResult.duplicateCount >= 5 || totalSecurityRisks >= 2 || totalVulnerabilities >= 2) {
                effortTier = 'High';
            } else if (totalComplexBlocks >= 1 || dupResult.duplicateCount >= 1 || totalSecurityRisks >= 1 || totalVulnerabilities >= 1) {
                effortTier = 'Medium';
            }

            return {
                type: 'scanComplete',
                payload: {
                    totalFiles: filesToScan.length,
                    analyzedFiles: successCount,
                    failedFiles: failCount,
                    complexBlocks: totalComplexBlocks,
                    duplicateBlocks: dupResult.duplicateCount,
                    securityRisks: totalSecurityRisks,
                    vulnerabilities: totalVulnerabilities,
                    effortTier,
                    message: 'Scan completed successfully',
                    erroredFiles,
                    duplicatePairs: dupResult.duplicatePairs.map(([a, b]) => ({ fileA: a, fileB: b, similarity: 0.75 })),
                    securityDetails: securityDetails.slice(0, 50) // Cap UI payload
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
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf8');
    }
}
