"use client";

export function usePlatform() {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  return {
    isElectron: !!api?.isElectron,
    platform: api?.platform ?? null,
    isMac: api?.platform === "darwin",
    isWindows: api?.platform === "win32",
    isLinux: api?.platform === "linux",
  };
}
