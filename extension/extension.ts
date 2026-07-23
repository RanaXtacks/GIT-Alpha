import * as vscode from 'vscode';
import { getGitHubSession } from './github';

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha is now active!');

    let disposable = vscode.commands.registerCommand('git-alpha.openDashboard', () => {
        vscode.window.showInformationMessage('GIT-Alpha Dashboard will open here!');
        // Phase 2 will implement the webview panel here
    });

    let loginDisposable = vscode.commands.registerCommand('git-alpha.login', async () => {
        await getGitHubSession();
    });

    context.subscriptions.push(disposable, loginDisposable);
}

export function deactivate() {}
