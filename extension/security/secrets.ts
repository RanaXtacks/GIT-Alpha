export interface SecretMatch {
    filePath: string;
    line: number;
    patternName: string;
}

export class SecretScanner {
    private secretPatterns: Array<{ name: string; regex: RegExp }> = [
        { name: 'AWS Access Key', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
        { name: 'GitHub Personal Access Token', regex: /\b(ghp_[a-zA-Z0-9]{36})\b/g },
        { name: 'Generic Secret Keyword', regex: /(?:api_key|apikey|secret|password|auth_token)\s*[:=]\s*["']([A-Za-z0-9+/=_-]{16,})["']/gi },
        { name: 'Private Key Header', regex: /-----BEGIN (?:RSA|OPENSSH|EC|PGP) PRIVATE KEY-----/g }
    ];

    /**
     * Calculates Shannon Entropy of a string: H(X) = -Σ p(x) log2 p(x)
     */
    private calculateEntropy(str: string): number {
        if (!str) return 0;
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
        const matches: SecretMatch[] = [];
        const lines = content.split('\n');

        lines.forEach((lineContent, index) => {
            const lineNum = index + 1;

            // Pattern-based check
            for (const pattern of this.secretPatterns) {
                pattern.regex.lastIndex = 0;
                if (pattern.regex.test(lineContent)) {
                    matches.push({ filePath, line: lineNum, patternName: pattern.name });
                    return;
                }
            }

            // High entropy string assignment check
            const assignmentMatch = lineContent.match(/["']([A-Za-z0-9+/=_-]{20,})["']/);
            if (assignmentMatch) {
                const candidate = assignmentMatch[1];
                const entropy = this.calculateEntropy(candidate);

                // High entropy (> 4.3 bits/char) indicates potential raw secret/token
                if (entropy > 4.3 && !this.isCommonFalsePositive(candidate)) {
                    matches.push({ filePath, line: lineNum, patternName: 'High Entropy String' });
                }
            }
        });

        return matches;
    }

    private isCommonFalsePositive(str: string): boolean {
        // Ignore UUIDs or standard hex hashes (e.g. git commits)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const isGitHash = /^[0-9a-f]{40}$/i.test(str);
        return isUUID || isGitHash;
    }
}
