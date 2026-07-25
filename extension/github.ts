import * as vscode from 'vscode';
import * as https from 'https';
import { GitHubRepoData } from '../shared/messages';

const GITHUB_AUTH_PROVIDER_ID = 'github';
const SCOPES = ['repo'];

/**
 * Prompts the user to log in to GitHub using VS Code's built-in authentication provider.
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

/**
 * Fetches repository metadata from GitHub API using the authenticated session.
 * Attempts to detect remote origin URL from the workspace.
 */
export async function fetchGitHubRepoData(workspaceRoot: string): Promise<GitHubRepoData | undefined> {
    try {
        const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
        if (!session) return undefined;

        // Try to detect owner/repo from git remote
        const ownerRepo = await detectGitHubRepo(workspaceRoot);
        if (!ownerRepo) return undefined;

        const repoData = await queryGitHubAPI(session.accessToken, `/repos/${ownerRepo}`);
        if (!repoData) return undefined;

        // Get latest commit
        let lastCommitMessage = 'N/A';
        let lastCommitDate = 'N/A';
        try {
            const commits = await queryGitHubAPI(session.accessToken, `/repos/${ownerRepo}/commits?per_page=1`);
            if (commits && Array.isArray(commits) && commits.length > 0) {
                lastCommitMessage = commits[0].commit?.message?.split('\n')[0] || 'N/A';
                lastCommitDate = commits[0].commit?.committer?.date || 'N/A';
            }
        } catch { /* Ignore commit fetch errors */ }

        return {
            name: repoData.full_name || ownerRepo,
            stars: repoData.stargazers_count || 0,
            forks: repoData.forks_count || 0,
            openIssues: repoData.open_issues_count || 0,
            lastCommitMessage,
            lastCommitDate: lastCommitDate !== 'N/A'
                ? new Date(lastCommitDate).toLocaleDateString()
                : 'N/A'
        };
    } catch (err) {
        console.warn('GitHub metadata fetch failed:', err);
        return undefined;
    }
}

async function detectGitHubRepo(workspaceRoot: string): Promise<string | undefined> {
    try {
        const gitConfigUri = vscode.Uri.file(`${workspaceRoot}/.git/config`);
        const data = await vscode.workspace.fs.readFile(gitConfigUri);
        const config = Buffer.from(data).toString('utf8');
        
        // Parse remote origin URL
        const urlMatch = config.match(/url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([^\/\s]+\/[^\.\s]+)/);
        if (urlMatch) {
            return urlMatch[1].replace(/\.git$/, '');
        }
    } catch { /* No git config */ }
    return undefined;
}

function queryGitHubAPI(token: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'api.github.com',
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'GIT-Alpha-Extension',
                    'Accept': 'application/vnd.github+json'
                },
                timeout: 8000
            },
            (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch { resolve(undefined); }
                });
            }
        );
        req.on('error', err => reject(err));
        req.on('timeout', () => { req.destroy(); resolve(undefined); });
        req.end();
    });
}
