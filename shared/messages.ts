export interface ScanResult {
    totalFiles: number;
    analyzedFiles: number;
    failedFiles: number;
    complexBlocks: number;
    message: string;
}

export type HostMessage =
  | { type: 'scanComplete'; payload: ScanResult }
  | { type: 'scanFailed'; payload: { fileCount: number; failedCount: number } };

export type WebviewMessage =
  | { type: 'requestRescan' }
  | { type: 'openFile'; path: string };
