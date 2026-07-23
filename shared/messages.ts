export type HostMessage =
  | { type: 'scanComplete'; payload: any }
  | { type: 'scanFailed'; payload: { fileCount: number; failedCount: number } };

export type WebviewMessage =
  | { type: 'requestRescan' }
  | { type: 'openFile'; path: string };
