const { contextBridge, ipcRenderer } = require("electron");

function getArgValue(key, fallback) {
  const prefix = `--${key}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  return arg.slice(prefix.length);
}

// Expose Electron-specific info to the renderer (window.__ELECTRON__)
contextBridge.exposeInMainWorld("__ELECTRON__", {
  isElectron: true,
  // The port where the Express API server is listening
  apiPort: parseInt(getArgValue("API_PORT", process.env.API_PORT || "3003"), 10),
  apiBaseUrl: getArgValue("API_BASE_URL", ""),
  appMode: getArgValue("APP_MODE", "host"),
  hostReachable: getArgValue("HOST_REACHABLE", "false") === "true",
  platform: process.platform,
  version: process.versions.electron,
  getRuntimeInfo: () => ipcRenderer.invoke("pms:get-runtime-info"),
  getNetworkConfig: () => ipcRenderer.invoke("pms:get-network-config"),
  setNetworkConfig: (config) => ipcRenderer.invoke("pms:set-network-config", config),
  getBackups: () => ipcRenderer.invoke("pms:get-backups"),
  createBackup: () => ipcRenderer.invoke("pms:create-backup"),
  restoreBackupDialog: () => ipcRenderer.invoke("pms:restore-backup-dialog"),
  restoreSpecificBackup: (backupPath) => ipcRenderer.invoke("pms:restore-backup", backupPath),
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});
