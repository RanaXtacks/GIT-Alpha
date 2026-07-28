export interface FileSignature {
    filePath: string;
    hash: number[]; // MinHash signature — fixed 64 integers per file
}

const MAX_FILES = 150;
const NUM_HASHES = 64; // MinHash signature size — constant memory per file

function fnv1a(str: string, seed: number): number {
    let hash = 2166136261 ^ seed;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash;
}

export class DuplicateDetector {
    private fileSignatures: FileSignature[] = [];

    /**
     * Computes a MinHash signature for the file content.
     * Uses fixed 64 hash functions → constant memory per file regardless of file size.
     */
    public addFile(filePath: string, content: string) {
        const normalizedPath = filePath.replace(/\\/g, '/');

        if (this.fileSignatures.length >= MAX_FILES) return;

        // Tokenize first 8000 chars only
        const trimmed = content.substring(0, 8000);
        const tokens = trimmed.replace(/\s+/g, ' ').trim().split(' ').filter(t => t.length > 0);
        if (tokens.length < 10) return;

        // Build 3-grams
        const shingles: string[] = [];
        for (let i = 0; i <= tokens.length - 3 && shingles.length < 300; i++) {
            shingles.push(tokens[i] + ' ' + tokens[i+1] + ' ' + tokens[i+2]);
        }
        if (shingles.length < 5) return;

        // MinHash calculation
        const signature: number[] = new Array(NUM_HASHES);
        for (let h = 0; h < NUM_HASHES; h++) {
            let minHash = Infinity;
            for (const shingle of shingles) {
                const hash = fnv1a(shingle, h * 31337);
                if (hash < minHash) minHash = hash;
            }
            signature[h] = minHash;
        }

        this.fileSignatures.push({ filePath: normalizedPath, hash: signature });
    }

    /**
     * Estimates Jaccard similarity using MinHash signatures.
     */
    public findDuplicates(similarityThreshold = 0.75): { duplicateCount: number; duplicatePairs: Array<[string, string]> } {
        const pairs: Array<[string, string]> = [];

        for (let i = 0; i < this.fileSignatures.length; i++) {
            for (let j = i + 1; j < this.fileSignatures.length; j++) {
                const sigA = this.fileSignatures[i].hash;
                const sigB = this.fileSignatures[j].hash;

                let matches = 0;
                for (let k = 0; k < NUM_HASHES; k++) {
                    if (sigA[k] === sigB[k]) matches++;
                }

                const similarity = matches / NUM_HASHES;
                if (similarity >= similarityThreshold) {
                    pairs.push([this.fileSignatures[i].filePath, this.fileSignatures[j].filePath]);
                }
            }
        }

        return {
            duplicateCount: pairs.length,
            duplicatePairs: pairs
        };
    }
}
