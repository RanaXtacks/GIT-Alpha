export interface SecretMatch {
    filePath: string;
    line: number;
    patternName: string;
}

// Files where secrets scanning makes sense (including .env files)
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
        const normalizedPath = filePath.replace(/\\/g, '/');
        const filename = normalizedPath.split('/').pop() || '';
        const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '');

        // Allow .env files or scannable extensions
        const isEnvFile = filename.startsWith('.env');
        if (!isEnvFile && !SCANNABLE_EXTENSIONS.has(ext)) {
            return [];
        }

        const matches: SecretMatch[] = [];
        const lines = content.split('\n');
        const linesToScan = Math.min(lines.length, 200);

        for (let index = 0; index < linesToScan; index++) {
            const rawLine = lines[index];
            const lineNum = index + 1;

            if (this.isIgnorableLine(rawLine)) {
                continue;
            }

            // CRITICAL PERFORMANCE FIX: Truncate line to max 300 chars to eliminate catastrophic regex backtracking!
            const lineContent = rawLine.substring(0, 300);

            // Pattern-based check (high confidence)
            let foundPattern = false;
            for (const pattern of this.secretPatterns) {
                pattern.regex.lastIndex = 0;
                if (pattern.regex.test(lineContent)) {
                    matches.push({ filePath: normalizedPath, line: lineNum, patternName: pattern.name });
                    foundPattern = true;
                    break;
                }
            }
            if (foundPattern) continue;

            // High entropy check (only for explicit string assignments, entropy threshold 4.8)
            const assignmentMatch = lineContent.match(/(?:=|:)\s*["']?([A-Za-z0-9+/=_-]{24,})["']?/);
            if (assignmentMatch) {
                const candidate = assignmentMatch[1];
                const entropy = this.calculateEntropy(candidate);

                if (entropy > 4.8 && !this.isCommonFalsePositive(candidate)) {
                    matches.push({ filePath: normalizedPath, line: lineNum, patternName: 'High Entropy String' });
                }
            }
        }

        return matches;
    }

    private isIgnorableLine(line: string): boolean {
        const trimmed = line.trim();
        if (trimmed.length < 10) return true;
        
        for (const pattern of FALSE_POSITIVE_LINE_PATTERNS) {
            if (pattern.test(trimmed)) return true;
        }
        return false;
    }

    private isCommonFalsePositive(str: string): boolean {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return true;
        if (/^[0-9a-f]{40}$/i.test(str)) return true;
        if (/^[0-9a-f]+$/i.test(str) && str.length <= 64) return true;
        if (/={2,}$/.test(str) && str.length > 100) return true;
        if (str.includes('/') || str.includes('\\')) return true;
        if (/(.)\1{4,}/.test(str)) return true;
        
        return false;
    }
}
