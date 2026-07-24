import * as vscode from 'vscode';
import * as z from 'zod';

export const ConfigSchema = z.object({
  thresholds: z.object({
    hugeFileLines: z.number().default(500),
    maxNestingDepth: z.number().default(4),
    duplicateBlockMinLines: z.number().default(15)
  }).default({}),
  ignore: z.array(z.string()).default(["**/generated/**", "**/*.min.js"]),
  telemetry: z.object({
    enabled: z.boolean().default(false)
  }).default({})
});

export type GitAlphaConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(workspaceRoot: string): Promise<GitAlphaConfig> {
    const configPath = vscode.Uri.file(`${workspaceRoot}/.healthdashboard.json`);
    try {
        const fileData = await vscode.workspace.fs.readFile(configPath);
        const configJson = JSON.parse(Buffer.from(fileData).toString('utf8'));
        
        const parsed = ConfigSchema.safeParse(configJson);
        if (parsed.success) {
            return parsed.data;
        } else {
            console.warn('GIT-Alpha config validation failed, using defaults', parsed.error);
        }
    } catch (e) {
        // File doesn't exist or is unreadable, fall through to defaults
    }
    
    // Return default config if file is missing or invalid
    return ConfigSchema.parse({});
}
