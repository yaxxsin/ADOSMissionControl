import { app, BrowserWindow, shell } from "electron";
import path from "path";

/** Create and configure the main application window. */
export function createMainWindow(port: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0A0A0F",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Required for WebSerial and WebUSB
      webSecurity: true,
    },
  });

  // Safety timeout: if ready-to-show never fires, force-show with DevTools
  const showTimeout = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      console.error("[window] ready-to-show timeout — forcing show");
      win.show();
      win.webContents.openDevTools({ mode: "detach" });
    }
  }, 10000);

  win.once("ready-to-show", () => {
    clearTimeout(showTimeout);
    win.show();
  });

  // Log page load events for diagnostics
  win.webContents.on("did-finish-load", () => {
    console.log("[window] did-finish-load");
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[window] did-fail-load: ${code} ${desc} ${url}`);
  });

  // Load the Next.js app
  win.loadURL(`http://127.0.0.1:${port}`);

  // Open external links in the default browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Also handle navigation to external URLs
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}
