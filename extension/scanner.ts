import * as vscode from 'vscode';
import * as fg from 'fast-glob';
import ignore from 'ignore';
import { loadConfig } from './config';
import { HostMessage } from '../shared/messages';
import { ASTParser } from './parser';

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
            const successes = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];

            const totalComplexBlocks = successes.reduce((acc, curr) => acc + curr.value, 0);

            // Return the initial MVP scan metrics
            return {
                type: 'scanComplete',
                payload: {
                    totalFiles: filesToScan.length,
                    analyzedFiles: successes.length,
                    failedFiles: failures.length,
                    complexBlocks: totalComplexBlocks,
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

    private async analyzeFile(filePath: string): Promise<number> {
        // Now using Tree-sitter!
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        const fileData = await vscode.workspace.fs.readFile(uri);
        const fileContent = Buffer.from(fileData).toString('utf8');
        
        // Pass to our AST Parser
        const complexity = this.parser.analyzeComplexity(filePath, fileContent);
        
        return complexity;
    }
}
