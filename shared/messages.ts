// ── Per-file detail interfaces ──────────────────────────────
export interface ErroredFile {
    file: string;
    errors: string[];
}

export interface DuplicatePair {
    fileA: string;
    fileB: string;
    similarity: number;
}

export interface SecurityDetail {
    file: string;
    line: number;
    type: string;
}

// ── Main scan result ────────────────────────────────────────
export interface ScanResult {
    totalFiles: number;       // All files found in workspace
    codeFiles: number;        // Only actual code files analyzed
    analyzedFiles: number;    // Code files that parsed successfully
    failedFiles: number;      // Code files with errors
    complexBlocks: number;
    duplicateBlocks: number;
    securityRisks: number;
    vulnerabilities: number;
    effortTier: 'Low' | 'Medium' | 'High';
    message: string;

    // Detailed per-file data
    erroredFiles: ErroredFile[];
    duplicatePairs: DuplicatePair[];
    securityDetails: SecurityDetail[];
}

// ── GitHub repo metadata ────────────────────────────────────
export interface GitHubRepoData {
    name: string;
    stars: number;
    forks: number;
    openIssues: number;
    lastCommitMessage: string;
    lastCommitDate: string;
}

// ── Messages from Extension Host → Webview ──────────────────
export type HostMessage =
  | { type: 'scanComplete'; payload: ScanResult }
  | { type: 'scanFailed'; payload: { fileCount: number; failedCount: number } }
  | { type: 'brainAnalysis'; payload: { file: string; suggestion: string } }
  | { type: 'brainLoading'; payload: { file: string } }
  | { type: 'githubData'; payload: GitHubRepoData };

// ── Messages from Webview → Extension Host ──────────────────
export type WebviewMessage =
  | { type: 'requestRescan' }
  | { type: 'requestBrainFix'; file: string }
  | { type: 'openFile'; path: string };
