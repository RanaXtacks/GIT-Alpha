export interface ScanResult {
    totalFiles: number;
    analyzedFiles: number;
    failedFiles: number;
    complexBlocks: number;
    duplicateBlocks: number;
    securityRisks: number;
    vulnerabilities: number;
    effortTier: 'Low' | 'Medium' | 'High';
    message: string;
}

export type HostMessage =
  | { type: 'scanComplete'; payload: ScanResult }
  | { type: 'scanFailed'; payload: { fileCount: number; failedCount: number } };

export type WebviewMessage =
  | { type: 'requestRescan' }
  | { type: 'openFile'; path: string };
