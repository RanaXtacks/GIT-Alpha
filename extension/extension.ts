import * as vscode from 'vscode';
import { getGitHubSession, fetchGitHubRepoData } from './github';
import { DashboardPanel } from './dashboardPanel';
import { WorkspaceScanner } from './scanner';
import { GeminiaBrain } from './brain';

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha!! is now active!');

    const brain = new GeminiaBrain(context);

    let openDashboardDisposable = vscode.commands.registerCommand('git-alpha.openDashboard', async () => {
        DashboardPanel.render(context.extensionUri);
        
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.onMessage(async (message) => {
                if (message.type === 'requestRescan') {
                    await runScan();
                } else if (message.type === 'requestBrainFix') {
                    await handleBrainFix(message.file);
                } else if (message.type === 'openFile') {
                    await handleOpenFile(message.path);
                }
            });
        }

        await runScan();
        await pushGitHubData();
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

    async function handleBrainFix(relativeFilePath: string) {
        if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) return;

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const scanner = new WorkspaceScanner(rootPath);

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.postMessage({
                type: 'brainLoading',
                payload: { file: relativeFilePath }
            });
        }

        try {
            const content = await scanner.getFileContent(relativeFilePath);
            const uri = vscode.Uri.file(`${rootPath}/${relativeFilePath}`);
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errors = diagnostics
                .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                .map(d => `Line ${d.range.start.line + 1}: ${d.message}`);

            const suggestion = await brain.analyzeAndSuggestFix(relativeFilePath, content, errors);

            if (DashboardPanel.currentPanel) {
                DashboardPanel.currentPanel.postMessage({
                    type: 'brainAnalysis',
                    payload: { file: relativeFilePath, suggestion }
                });
            }
        } catch (err: any) {
            console.error('Brain handler error:', err);
            // Send error back to dashboard so loading spinner stops
            if (DashboardPanel.currentPanel) {
                DashboardPanel.currentPanel.postMessage({
                    type: 'brainAnalysis',
                    payload: { file: relativeFilePath, suggestion: `❌ Brain error: ${err.message || 'Could not read file. Make sure the file exists in the workspace.'}` }
                });
            }
        }
    }

    async function handleOpenFile(relativeFilePath: string) {
        if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) return;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const uri = vscode.Uri.file(`${rootPath}/${relativeFilePath}`);
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch (e: any) {
            vscode.window.showErrorMessage(`Could not open file ${relativeFilePath}: ${e.message}`);
        }
    }

    async function pushGitHubData() {
        if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) return;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const ghData = await fetchGitHubRepoData(rootPath);
        if (ghData && DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.postMessage({
                type: 'githubData',
                payload: ghData
            });
        }
    }

    let loginDisposable = vscode.commands.registerCommand('git-alpha.login', async () => {
        const session = await getGitHubSession();
        if (session) {
            await pushGitHubData();
        }
    });

    let setBrainKeyDisposable = vscode.commands.registerCommand('git-alpha.setGeminiKey', async () => {
        await brain.setApiKey();
    });

    // File watcher debounce
    let scanTimeout: NodeJS.Timeout | undefined;
    let watcherDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.uri.scheme !== 'file' || !vscode.workspace.workspaceFolders) { return; }
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(async () => {
            await runScan();
        }, 1000);
    });

    context.subscriptions.push(openDashboardDisposable, loginDisposable, setBrainKeyDisposable, watcherDisposable);
}

export function deactivate() {}
