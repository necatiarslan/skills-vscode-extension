export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

interface VsCodeApiLike {
  postMessage(message: unknown): void;
  setState(state: unknown): void;
  getState(): unknown;
}

declare global {
  function acquireVsCodeApi(): VsCodeApiLike;
}

class VSCodeAPI {
  private readonly vscodeApi: VsCodeApiLike | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: WebviewMessage): void {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    }
  }

  public getState<TState = unknown>(): TState | undefined {
    return this.vscodeApi?.getState() as TState | undefined;
  }

  public setState(state: unknown): void {
    this.vscodeApi?.setState(state);
  }
}

export const vscodeBridge = new VSCodeAPI();
