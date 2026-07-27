import * as vscode from 'vscode';
import { getGitHubSession, fetchGitHubRepoData } from './github';
import { DashboardPanel } from './dashboardPanel';
import { WorkspaceScanner } from './scanner';
import { GeminiaBrain } from './brain';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha!! is now active!');

    const brain = new GeminiaBrain(context);

    // Create live Status Bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'git-alpha.openDashboard';
    statusBarItem.text = '$(shield) GIT-Alpha: Scanning...';
    statusBarItem.tooltip = 'Click to open GIT-Alpha!! Dashboard';
    statusBarItem.show();

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

        // Fire-and-forget — panel renders instantly, data arrives via postMessage
        runScan();
        pushGitHubData();
    });

    let isScanRunning = false;

    async function runScan() {
        if (isScanRunning) return; // Prevent concurrent scans
        isScanRunning = true;
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const scanner = new WorkspaceScanner(rootPath);
                const result = await scanner.scan();
                
                if (result.type === 'scanComplete') {
                    const p = result.payload;
                    // Update Status Bar live
                    const tierIcon = p.effortTier === 'High' ? '$(error)' : p.effortTier === 'Medium' ? '$(warning)' : '$(check)';
                    statusBarItem.text = `${tierIcon} GIT-Alpha: ${p.effortTier} Effort | ${p.securityRisks} Risks`;
                    statusBarItem.tooltip = `GIT-Alpha!! Health Status:\n- Effort Tier: ${p.effortTier}\n- Security Risks: ${p.securityRisks}\n- CVE Vulns: ${p.vulnerabilities}\n- Errored Files: ${p.failedFiles}\nClick to open Dashboard`;

                    if (DashboardPanel.currentPanel) {
                        DashboardPanel.currentPanel.postMessage(result);
                    }
                }
            }
        } catch (e: any) {
            statusBarItem.text = '$(alert) GIT-Alpha: Error';
            vscode.window.showErrorMessage(`Scanner failed: ${e.message}`);
        } finally {
            isScanRunning = false;
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

    context.subscriptions.push(
        statusBarItem,
        openDashboardDisposable,
        loginDisposable,
        setBrainKeyDisposable,
        watcherDisposable
    );

    // Status bar will populate on first dashboard open or file save
    statusBarItem.text = '$(shield) GIT-Alpha: Ready';
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
