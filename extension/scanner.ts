import * as vscode from 'vscode';
import fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage } from '../shared/messages';
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
            
            // Setup ignore rules (always ignoring node_modules, .git, etc.)
            const ig = ignore().add(['.git', 'node_modules', 'dist', 'venv', 'webview-ui', ...config.ignore]);

            // Find files while ignoring heavy folders directly during disk traversal
            const entries = await fg(['**/*'], { 
                cwd: this.workspaceRoot, 
                onlyFiles: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.venv/**', '**/webview-ui/build/**', ...config.ignore]
            });

            // Filter out ignored files
            const filesToScan = entries.filter(f => !ig.ignores(f));

            // Process files with isolation so one bad file doesn't crash everything
            const duplicateDetector = new DuplicateDetector();
            const secretScanner = new SecretScanner();
            let totalSecurityRisks = 0;

            let pkgJsonContent: string | undefined;
            let reqTxtContent: string | undefined;

            const results = await Promise.allSettled(filesToScan.map(async f => {
                const uri = vscode.Uri.file(`${this.workspaceRoot}/${f}`);
                const diagnostics = vscode.languages.getDiagnostics(uri);
                if (diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error)) {
                    throw new Error(`Syntax error`);
                }

                const fileData = await vscode.workspace.fs.readFile(uri);
                const fileContent = Buffer.from(fileData).toString('utf8');

                // Track package manifest content for vuln scanning
                if (f.endsWith('package.json')) pkgJsonContent = fileContent;
                if (f.endsWith('requirements.txt')) reqTxtContent = fileContent;

                // Run Secret Scan
                const secrets = secretScanner.scanFile(f, fileContent);
                totalSecurityRisks += secrets.length;

                // Run Duplicate Detection
                duplicateDetector.addFile(f, fileContent);

                return this.parser.analyzeComplexity(f, fileContent);
            }));
            
            const failures = results.filter(r => r.status === 'rejected');
            const successes = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];

            const totalComplexBlocks = successes.reduce((acc, curr) => acc + curr.value, 0);

            // Run Duplicate Detection
            const { duplicateCount } = duplicateDetector.findDuplicates(0.75);

            // Run Vulnerability Scan
            const vulnerabilityScanner = new VulnerabilityScanner();
            const totalVulnerabilities = await vulnerabilityScanner.scanDependencies(pkgJsonContent, reqTxtContent);

            // Determine Effort Tier (Low: 0 complex & 0 security risks, Medium: 1-5 complex or 1 security risk, High: 6+ complex or 2+ security risks)
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
                    message: 'Scan completed successfully'
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

    private async analyzeFile(filePath: string, duplicateDetector: DuplicateDetector): Promise<number> {
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        
        // Check if VS Code's language servers have flagged this file with syntax errors
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const hasErrors = diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error);
        
        if (hasErrors) {
            throw new Error(`File contains syntax errors detected by IDE`);
        }

        const fileData = await vscode.workspace.fs.readFile(uri);
        const fileContent = Buffer.from(fileData).toString('utf8');
        
        // Feed into Duplicate Detector
        duplicateDetector.addFile(filePath, fileContent);

        return this.parser.analyzeComplexity(filePath, fileContent);
    }
}
