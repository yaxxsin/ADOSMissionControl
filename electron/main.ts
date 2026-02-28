import { app, ipcMain } from "electron";
import { setupPermissions } from "./permissions";
import { startServer, stopServer } from "./server";
import { createMainWindow } from "./window";
import { setupAutoUpdater } from "./updater";

// Enable Chromium features required by Command GCS
app.commandLine.appendSwitch("enable-features", "WebSerial,WebUSB");

// Parse CLI flags
const isDemoMode = process.argv.includes("--demo");

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(async () => {
  // Setup device permissions (WebSerial, WebUSB)
  setupPermissions();

  // Start the embedded Next.js standalone server
  const port = await startServer({ demo: isDemoMode });

  // In packaged builds, passively log /_next/static requests for diagnostics
  // (no interception — Chromium talks directly to the localhost server)
  if (app.isPackaged) {
    const { session } = require("electron");
    const filter = { urls: ["http://127.0.0.1:*/_next/*"] };
    session.defaultSession.webRequest.onCompleted(filter, (details: any) => {
      console.log(`[req] ${details.statusCode} ${details.url.substring(0, 120)}`);
    });
    session.defaultSession.webRequest.onErrorOccurred(filter, (details: any) => {
      console.error(`[req] ERR ${details.error} ${details.url.substring(0, 120)}`);
    });
  }

  // Create the main browser window
  const win = createMainWindow(port);

  // IPC handlers for window controls
  ipcMain.handle("window:minimize", () => win.minimize());
  ipcMain.handle("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.handle("window:close", () => win.close());
  ipcMain.handle("app:version", () => app.getVersion());

  // Setup auto-updater (silent check on startup)
  setupAutoUpdater(win);

  // macOS: re-create window when dock icon clicked
  app.on("activate", () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });
});

app.on("second-instance", () => {
  // Focus existing window if user tries to open another instance
  const wins = require("electron").BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    if (wins[0].isMinimized()) wins[0].restore();
    wins[0].focus();
  }
});

app.on("window-all-closed", async () => {
  await stopServer();
  app.quit();
});
