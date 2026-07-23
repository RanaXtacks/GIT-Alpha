import * as vscode from 'vscode';
import { getGitHubSession } from './github';
import { DashboardPanel } from './dashboardPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha is now active!');

    let disposable = vscode.commands.registerCommand('git-alpha.openDashboard', () => {
        DashboardPanel.render(context.extensionUri);
    });

    let loginDisposable = vscode.commands.registerCommand('git-alpha.login', async () => {
        await getGitHubSession();
    });

    context.subscriptions.push(disposable, loginDisposable);
}

export function deactivate() {}
