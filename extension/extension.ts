import * as vscode from 'vscode';
import { getGitHubSession } from './github';
import { DashboardPanel } from './dashboardPanel';
import { WorkspaceScanner } from './scanner';

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha is now active!');

    let disposable = vscode.commands.registerCommand('git-alpha.openDashboard', async () => {
        DashboardPanel.render(context.extensionUri);
        
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.onMessage(async (message) => {
                if (message.type === 'requestRescan') {
                    await runScan();
                }
            });
        }

        await runScan();
    });

    async function runScan() {
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const scanner = new WorkspaceScanner(rootPath);
                const result = await scanner.scan();
                if (DashboardPanel.currentPanel) {
                    DashboardPanel.currentPanel.postMessage(result);
                }
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Scanner failed: ${e.message}`);
        }
    }

    let loginDisposable = vscode.commands.registerCommand('git-alpha.login', async () => {
        await getGitHubSession();
    });

    // Setup file watcher with debounce
    let scanTimeout: NodeJS.Timeout | undefined;
    
    let watcherDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Skip scanning if the saved file is something internal or we don't have a workspace
        if (document.uri.scheme !== 'file' || !vscode.workspace.workspaceFolders) { return; }
        
        // Clear previous timeout (debounce)
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
        
        scanTimeout = setTimeout(async () => {
            await runScan();
        }, 1000); // 1-second debounce
    });

    context.subscriptions.push(disposable, loginDisposable, watcherDisposable);
}

export function deactivate() {}
