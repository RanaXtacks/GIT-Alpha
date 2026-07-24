import * as vscode from 'vscode';
import * as fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage } from '../shared/messages';

export class WorkspaceScanner {
    constructor(private workspaceRoot: string) {}

    async scan(): Promise<HostMessage> {
        try {
            const config = await loadConfig(this.workspaceRoot);
            
            // Setup ignore rules (always ignoring node_modules, .git, etc.)
            const ig = ignore().add(['.git', 'node_modules', 'dist', 'venv', 'webview-ui', ...config.ignore]);

            // Find all files
            const entries = await fg(['**/*'], { 
                cwd: this.workspaceRoot, 
                onlyFiles: true,
                dot: true
            });

            // Filter out ignored files
            const filesToScan = entries.filter(f => !ig.ignores(f));

            // Process files with isolation so one bad file doesn't crash everything
            const results = await Promise.allSettled(filesToScan.map(f => this.analyzeFile(f)));
            
            const failures = results.filter(r => r.status === 'rejected');
            const successes = results.filter(r => r.status === 'fulfilled');

            // Return the initial MVP scan metrics
            return {
                type: 'scanComplete',
                payload: {
                    totalFiles: filesToScan.length,
                    analyzedFiles: successes.length,
                    failedFiles: failures.length,
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

    private async analyzeFile(filePath: string): Promise<void> {
        // In Phase 3, this will use Tree-sitter. 
        // For Phase 2, we just ensure we can read the file safely without crashing.
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        await vscode.workspace.fs.readFile(uri);
        return Promise.resolve();
    }
}
