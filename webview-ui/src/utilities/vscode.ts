class VSCodeAPIWrapper {
  private readonly vsCodeApi: any | undefined;

  constructor() {
    // Check if the acquireVsCodeApi function exists (it only exists when running inside VS Code)
    if (typeof (window as any).acquireVsCodeApi === "function") {
      this.vsCodeApi = (window as any).acquireVsCodeApi();
    }
  }

  public postMessage(message: unknown) {
    if (this.vsCodeApi) {
      this.vsCodeApi.postMessage(message);
    } else {
      console.log("Mock postMessage:", message);
    }
  }
}

// Export a single instance to be used across the app
export const vscode = new VSCodeAPIWrapper();
