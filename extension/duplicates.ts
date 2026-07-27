export interface FileSignature {
    filePath: string;
    shingles: Set<string>;
}

const MAX_FILES_FOR_DUPLICATE_CHECK = 200; // Cap to prevent O(n²) explosion

export class DuplicateDetector {
    private fileSignatures: FileSignature[] = [];

    /**
     * Extracts token shingles (k=5) from code content.
     * Caps shingles per file at 500 to prevent memory bloat.
     */
    public addFile(filePath: string, content: string) {
        // Only keep first 10,000 chars for shingle extraction (no need to tokenize giant files)
        const trimmed = content.substring(0, 10000);
        
        const tokens = trimmed
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(t => t.length > 0);

        if (tokens.length < 5) return;

        const shingles = new Set<string>();
        const limit = Math.min(tokens.length - 4, 500); // Cap at 500 shingles
        for (let i = 0; i < limit; i++) {
            const shingle = tokens.slice(i, i + 5).join(' ');
            shingles.add(shingle);
        }

        if (shingles.size > 0 && this.fileSignatures.length < MAX_FILES_FOR_DUPLICATE_CHECK) {
            this.fileSignatures.push({ filePath, shingles });
        }
    }

    /**
     * Calculates Jaccard Similarity between file shingles
     * J(A, B) = |A ∩ B| / |A ∪ B|
     */
    public findDuplicates(similarityThreshold = 0.75): { duplicateCount: number; duplicatePairs: Array<[string, string]> } {
        const pairs: Array<[string, string]> = [];

        for (let i = 0; i < this.fileSignatures.length; i++) {
            for (let j = i + 1; j < this.fileSignatures.length; j++) {
                const sigA = this.fileSignatures[i];
                const sigB = this.fileSignatures[j];

                const similarity = this.jaccardSimilarity(sigA.shingles, sigB.shingles);
                if (similarity >= similarityThreshold) {
                    pairs.push([sigA.filePath, sigB.filePath]);
                }
            }
        }

        return {
            duplicateCount: pairs.length,
            duplicatePairs: pairs
        };
    }

    private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
        if (setA.size === 0 || setB.size === 0) return 0;

        let intersectionSize = 0;
        const smallerSet = setA.size < setB.size ? setA : setB;
        const largerSet = setA.size < setB.size ? setB : setA;

        for (const item of smallerSet) {
            if (largerSet.has(item)) {
                intersectionSize++;
            }
        }

        const unionSize = setA.size + setB.size - intersectionSize;
        return unionSize === 0 ? 0 : intersectionSize / unionSize;
    }
}
