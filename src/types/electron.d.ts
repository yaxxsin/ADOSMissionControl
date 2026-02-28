interface ElectronAPI {
  isElectron: true;
  platform: "darwin" | "win32" | "linux";
  getVersion: () => Promise<string>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  onUpdateAvailable: (cb: (info: { version: string }) => void) => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
