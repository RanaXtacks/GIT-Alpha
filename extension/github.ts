import * as vscode from 'vscode';

const GITHUB_AUTH_PROVIDER_ID = 'github';
// The scopes we need for the GitHub API. 
// 'repo' gives us access to read/write repositories.
const SCOPES = ['repo'];

/**
 * Prompts the user to log in to GitHub using VS Code's built-in authentication provider.
 * This automatically handles the OAuth flow and token storage securely.
 */
export async function getGitHubSession(): Promise<vscode.AuthenticationSession | undefined> {
    try {
        const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
        
        if (session) {
            vscode.window.showInformationMessage(`Successfully logged in to GitHub as ${session.account.label}`);
            return session;
        }
    } catch (error) {
        vscode.window.showErrorMessage('Failed to log in to GitHub. Please try again.');
        console.error('GitHub Auth Error:', error);
    }
    
    return undefined;
}
