import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('GIT-Alpha is now active!');

    let disposable = vscode.commands.registerCommand('git-alpha.openDashboard', () => {
        vscode.window.showInformationMessage('GIT-Alpha Dashboard will open here!');
        // Phase 2 will implement the webview panel here
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
