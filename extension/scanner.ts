import * as vscode from 'vscode';
import fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage, ErroredFile, SecurityDetail } from '../shared/messages';
import { ASTParser } from './parser';
import { DuplicateDetector } from './duplicates';
import { SecretScanner } from './security/secrets';
import { VulnerabilityScanner } from './security/vulnerabilities';

export class WorkspaceScanner {
    private parser: ASTParser;

    constructor(private workspaceRoot: string) {
        this.parser = new ASTParser();
    }

    async scan(): Promise<HostMessage> {
        try {
            const config = await loadConfig(this.workspaceRoot);
            
            // Setup ignore rules
            const ig = ignore().add(['.git', 'node_modules', 'dist', 'venv', 'webview-ui', ...config.ignore]);

            // Find ALL files (deep analysis)
            const entries = await fg(['**/*'], { 
                cwd: this.workspaceRoot, 
                onlyFiles: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.venv/**', '**/webview-ui/build/**', ...config.ignore]
            });

            const filesToScan = entries.filter(f => !ig.ignores(f));

            // ── Collectors ──────────────────────────────────
            const duplicateDetector = new DuplicateDetector();
            const secretScanner = new SecretScanner();
            const erroredFiles: ErroredFile[] = [];
            const securityDetails: SecurityDetail[] = [];
            let totalSecurityRisks = 0;
            let pkgJsonContent: string | undefined;
            let reqTxtContent: string | undefined;

            // ── Deep per-file analysis ──────────────────────
            const results = await Promise.allSettled(filesToScan.map(async f => {
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

                const fileData = await vscode.workspace.fs.readFile(uri);
                const fileContent = Buffer.from(fileData).toString('utf8');

                // Track manifests for vuln scanning
                if (f.endsWith('package.json')) pkgJsonContent = fileContent;
                if (f.endsWith('requirements.txt')) reqTxtContent = fileContent;

                // Secret Scan — collect per-file details
                const secrets = secretScanner.scanFile(f, fileContent);
                if (secrets.length > 0) {
                    for (const s of secrets) {
                        securityDetails.push({ file: s.filePath, line: s.line, type: s.patternName });
                    }
                    totalSecurityRisks += secrets.length;
                }

                // Duplicate Detection
                duplicateDetector.addFile(f, fileContent);

                return this.parser.analyzeComplexity(f, fileContent);
            }));
            
            const failures = results.filter(r => r.status === 'rejected');
            const successes = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];
            const totalComplexBlocks = successes.reduce((acc, curr) => acc + curr.value, 0);

            // Duplicate Detection — get actual pairs
            const { duplicateCount, duplicatePairs } = duplicateDetector.findDuplicates(0.75);

            // Vulnerability Scan
            const vulnerabilityScanner = new VulnerabilityScanner();
            const totalVulnerabilities = await vulnerabilityScanner.scanDependencies(pkgJsonContent, reqTxtContent);

            // Effort Tier
            let effortTier: 'Low' | 'Medium' | 'High' = 'Low';
            if (totalComplexBlocks >= 6 || duplicateCount >= 5 || totalSecurityRisks >= 2 || totalVulnerabilities >= 2) {
                effortTier = 'High';
            } else if (totalComplexBlocks >= 1 || duplicateCount >= 1 || totalSecurityRisks >= 1 || totalVulnerabilities >= 1) {
                effortTier = 'Medium';
            }

            return {
                type: 'scanComplete',
                payload: {
                    totalFiles: filesToScan.length,
                    analyzedFiles: successes.length,
                    failedFiles: failures.length,
                    complexBlocks: totalComplexBlocks,
                    duplicateBlocks: duplicateCount,
                    securityRisks: totalSecurityRisks,
                    vulnerabilities: totalVulnerabilities,
                    effortTier,
                    message: 'Scan completed successfully',

                    // Detailed data
                    erroredFiles,
                    duplicatePairs: duplicatePairs.map(([a, b]) => ({ fileA: a, fileB: b, similarity: 0.75 })),
                    securityDetails
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

    /**
     * Reads a specific file's content for Brain analysis
     */
    public async getFileContent(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf8');
    }
}
