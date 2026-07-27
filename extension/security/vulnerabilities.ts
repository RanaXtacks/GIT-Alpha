import * as https from 'https';

export interface VulnerabilityResult {
    packageName: string;
    version?: string;
    ecosystem: string;
    vulnerabilitiesCount: number;
}

interface CacheEntry {
    resultCount: number;
    timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export class VulnerabilityScanner {
    // In-memory cache keyed by "ecosystem:packageName@version"
    private static cache: Map<string, CacheEntry> = new Map();

    /**
     * Checks package dependencies against OSV.dev API (v1/querybatch)
     */
    public async scanDependencies(packageJsonContent?: string, requirementsTxtContent?: string): Promise<number> {
        const queries: Array<{ package: { name: string; ecosystem: string }; version?: string }> = [];

        // Parse package.json dependencies
        if (packageJsonContent) {
            try {
                const parsed = JSON.parse(packageJsonContent);
                const deps = { ...parsed.dependencies, ...parsed.devDependencies };
                for (const [name, rawVer] of Object.entries(deps)) {
                    const version = (rawVer as string).replace(/[\^~>=]/g, '').trim();
                    queries.push({
                        package: { name, ecosystem: 'npm' },
                        ...(version ? { version } : {})
                    });
                }
            } catch (e) {
                console.error('Error parsing package.json for vulns:', e);
            }
        }

        // Parse requirements.txt dependencies
        if (requirementsTxtContent) {
            const lines = requirementsTxtContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==([a-zA-Z0-9_.-]+))?/);
                    if (match) {
                        queries.push({
                            package: { name: match[1], ecosystem: 'PyPI' },
                            ...(match[2] ? { version: match[2] } : {})
                        });
                    }
                }
            }
        }

        if (queries.length === 0) return 0;

        // Separate cached vs uncached queries
        let totalVulns = 0;
        const uncachedQueries: typeof queries = [];
        const now = Date.now();

        for (const q of queries) {
            const key = `${q.package.ecosystem}:${q.package.name}@${q.version || 'latest'}`;
            const cached = VulnerabilityScanner.cache.get(key);

            if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
                totalVulns += cached.resultCount;
            } else {
                uncachedQueries.push(q);
            }
        }

        if (uncachedQueries.length === 0) {
            return totalVulns;
        }

        // Query OSV API in batch for remaining uncached packages (max 50)
        try {
            const responseData = await this.queryOSV(uncachedQueries.slice(0, 50));
            if (responseData && Array.isArray(responseData.results)) {
                responseData.results.forEach((result: any, idx: number) => {
                    const q = uncachedQueries[idx];
                    if (!q) return;

                    const count = (result.vulns && Array.isArray(result.vulns)) ? result.vulns.length : 0;
                    totalVulns += count;

                    // Cache response
                    const key = `${q.package.ecosystem}:${q.package.name}@${q.version || 'latest'}`;
                    VulnerabilityScanner.cache.set(key, { resultCount: count, timestamp: now });
                });
            }
            return totalVulns;
        } catch (err) {
            console.warn('OSV vulnerability scan failed/timed out:', err);
            return totalVulns;
        }
    }

    private queryOSV(queries: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ queries });
            const req = https.request(
                'https://api.osv.dev/v1/querybatch',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    },
                    timeout: 4000
                },
                (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(body));
                        } catch {
                            resolve({ results: [] });
                        }
                    });
                }
            );

            req.on('error', err => reject(err));
            req.on('timeout', () => {
                req.destroy();
                resolve({ results: [] });
            });

            req.write(data);
            req.end();
        });
    }
}
