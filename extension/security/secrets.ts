export interface SecretMatch {
    filePath: string;
    line: number;
    patternName: string;
}

// Files where secrets scanning makes sense
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.rb',
    '.php', '.sh', '.bash', '.env', '.yml', '.yaml', '.toml', '.cfg', '.ini'
]);

// Lines that are almost never secrets — skip them
const FALSE_POSITIVE_LINE_PATTERNS = [
    /^\s*(import|from|require|export)\b/,     // import statements
    /^\s*\/\//,                                // JS comments
    /^\s*#/,                                   // Python/shell comments  
    /^\s*\*/,                                  // JSDoc comments
    /url\s*\(/i,                               // CSS url()
    /src\s*=/i,                                // HTML src=
    /href\s*=/i,                               // HTML href=
    /data:[a-z]+\/[a-z]+;base64/i,            // base64 data URIs
    /integrity\s*[:=]/i,                       // npm integrity hashes
    /sha[0-9]+-/i,                             // SHA hashes in lockfiles
    /[a-z]+:\/\/\S+/i,                         // URLs
];

export class SecretScanner {
    private secretPatterns: Array<{ name: string; regex: RegExp }> = [
        { name: 'AWS Access Key', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
        { name: 'GitHub Personal Access Token', regex: /\b(ghp_[a-zA-Z0-9]{36})\b/g },
        { name: 'GitHub OAuth Token', regex: /\b(gho_[a-zA-Z0-9]{36})\b/g },
        { name: 'Generic Secret Assignment', regex: /(?:api_key|apikey|secret_key|secret|password|auth_token|access_token)\s*[:=]\s*["']([A-Za-z0-9+/=_-]{16,})["']/gi },
        { name: 'Private Key Header', regex: /-----BEGIN (?:RSA|OPENSSH|EC|PGP) PRIVATE KEY-----/g }
    ];

    private calculateEntropy(str: string): number {
        if (!str || str.length < 16) return 0;
        const frequencies: Record<string, number> = {};
        for (const char of str) {
            frequencies[char] = (frequencies[char] || 0) + 1;
        }
        let entropy = 0;
        const len = str.length;
        for (const count of Object.values(frequencies)) {
            const p = count / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    public scanFile(filePath: string, content: string): SecretMatch[] {
        // Skip files that aren't likely to contain secrets
        const ext = '.' + (filePath.split('.').pop()?.toLowerCase() || '');
        if (!SCANNABLE_EXTENSIONS.has(ext)) {
            return [];
        }

        const matches: SecretMatch[] = [];
        
        // Only scan first 200 lines — secrets are almost always at the top
        const lines = content.split('\n');
        const linesToScan = Math.min(lines.length, 200);

        for (let index = 0; index < linesToScan; index++) {
            const lineContent = lines[index];
            const lineNum = index + 1;

            // Skip lines that are obviously not secrets
            if (this.isIgnorableLine(lineContent)) {
                continue;
            }

            // Pattern-based check (high confidence)
            let foundPattern = false;
            for (const pattern of this.secretPatterns) {
                pattern.regex.lastIndex = 0;
                if (pattern.regex.test(lineContent)) {
                    matches.push({ filePath, line: lineNum, patternName: pattern.name });
                    foundPattern = true;
                    break;
                }
            }
            if (foundPattern) continue;

            // High entropy check (only for explicit string assignments)
            // Raised threshold to 4.8 to reduce false positives
            const assignmentMatch = lineContent.match(/(?:=|:)\s*["']([A-Za-z0-9+/=_-]{24,})["']/);
            if (assignmentMatch) {
                const candidate = assignmentMatch[1];
                const entropy = this.calculateEntropy(candidate);

                if (entropy > 4.8 && !this.isCommonFalsePositive(candidate)) {
                    matches.push({ filePath, line: lineNum, patternName: 'High Entropy String' });
                }
            }
        }

        return matches;
    }

    private isIgnorableLine(line: string): boolean {
        const trimmed = line.trim();
        if (trimmed.length < 10 || trimmed.length > 500) return true;
        
        for (const pattern of FALSE_POSITIVE_LINE_PATTERNS) {
            if (pattern.test(trimmed)) return true;
        }
        return false;
    }

    private isCommonFalsePositive(str: string): boolean {
        // UUIDs
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return true;
        // Git hashes
        if (/^[0-9a-f]{40}$/i.test(str)) return true;
        // Pure hex (likely a hash, not a secret)
        if (/^[0-9a-f]+$/i.test(str) && str.length <= 64) return true;
        // Pure base64 padding (likely encoded data, not a key)
        if (/={2,}$/.test(str) && str.length > 100) return true;
        // Looks like a file path or module name
        if (str.includes('/') || str.includes('\\')) return true;
        // Repeated characters (not random enough to be a secret)
        if (/(.)\1{4,}/.test(str)) return true;
        
        return false;
    }
}
