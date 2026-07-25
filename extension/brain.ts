import * as vscode from 'vscode';
import * as https from 'https';

const GEMINI_SECRET_KEY = 'git-alpha.geminiApiKey';

export class GeminiaBrain {
    private apiKey: string | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Ensures the Gemini API key is available. Prompts user if not stored.
     */
    public async ensureApiKey(): Promise<string | undefined> {
        // Try to load from SecretStorage first
        this.apiKey = await this.context.secrets.get(GEMINI_SECRET_KEY);

        if (!this.apiKey) {
            const input = await vscode.window.showInputBox({
                prompt: '🧠 Enter your Gemini API Key for GIT-Alpha Brain',
                placeHolder: 'AIzaSy...',
                password: true,
                ignoreFocusOut: true
            });

            if (input && input.trim().length > 10) {
                this.apiKey = input.trim();
                await this.context.secrets.store(GEMINI_SECRET_KEY, this.apiKey);
                vscode.window.showInformationMessage('✅ Gemini API key saved securely.');
            } else {
                vscode.window.showWarningMessage('GIT-Alpha Brain requires a valid Gemini API key.');
                return undefined;
            }
        }

        return this.apiKey;
    }

    /**
     * Sends file content + errors to Gemini and returns a fix suggestion.
     */
    public async analyzeAndSuggestFix(
        filePath: string,
        fileContent: string,
        errors: string[]
    ): Promise<string> {
        const apiKey = await this.ensureApiKey();
        if (!apiKey) {
            return 'No Gemini API key configured. Use command "GIT-Alpha: Set Gemini API Key" to add one.';
        }

        const prompt = `You are a senior code reviewer. Analyze the following file and its errors.
Return a concise, actionable fix suggestion (max 200 words). Include the corrected code snippet if possible.

**File**: ${filePath}

**Errors detected**:
${errors.map(e => `- ${e}`).join('\n')}

**File Content**:
\`\`\`
${fileContent.substring(0, 3000)}
\`\`\`

Respond with:
1. What is wrong (1 sentence)
2. How to fix it (code snippet or steps)`;

        try {
            const response = await this.callGeminiAPI(apiKey, prompt);
            return response;
        } catch (err: any) {
            console.error('Gemini Brain error:', err);
            if (err.message?.includes('401') || err.message?.includes('403')) {
                // Invalid key — clear it so user is prompted again
                await this.context.secrets.delete(GEMINI_SECRET_KEY);
                return '❌ Invalid Gemini API key. It has been cleared. Please try again with a valid key.';
            }
            return `❌ Gemini API error: ${err.message || 'Unknown error'}`;
        }
    }

    /**
     * Allows user to manually set/update API key
     */
    public async setApiKey(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: '🧠 Enter your Gemini API Key',
            placeHolder: 'AIzaSy...',
            password: true,
            ignoreFocusOut: true
        });

        if (input && input.trim().length > 10) {
            await this.context.secrets.store(GEMINI_SECRET_KEY, input.trim());
            this.apiKey = input.trim();
            vscode.window.showInformationMessage('✅ Gemini API key updated successfully.');
        }
    }

    private callGeminiAPI(apiKey: string, prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            });

            const url = `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const req = https.request(
                {
                    hostname: 'generativelanguage.googleapis.com',
                    path: url,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    },
                    timeout: 15000
                },
                (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`${res.statusCode}: ${data.substring(0, 200)}`));
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                            resolve(text || 'No suggestion returned from Gemini.');
                        } catch {
                            resolve('Failed to parse Gemini response.');
                        }
                    });
                }
            );

            req.on('error', err => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Gemini API request timed out (15s)'));
            });

            req.write(body);
            req.end();
        });
    }
}
