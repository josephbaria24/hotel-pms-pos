const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const isDev = !app.isPackaged;

function getAllIpAddresses() {
  const interfaces = os.networkInterfaces();
  const physicalIps = [];
  const virtualIps = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = 
      lowerName.includes("virtualbox") || 
      lowerName.includes("vbox") || 
      lowerName.includes("vmware") || 
      lowerName.includes("wsl") || 
      lowerName.includes("hyper-v") || 
      lowerName.includes("host-only") || 
      lowerName.includes("npcap") ||
      lowerName.includes("loopback");

    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        if (isVirtual) {
          virtualIps.push(iface.address);
        } else {
          physicalIps.push(iface.address);
        }
      }
    }
  }

  // Combine placing physical (Wi-Fi, Ethernet) first
  return [...physicalIps, ...virtualIps];
}

function getLocalIpAddress() {
  const ips = getAllIpAddresses();
  return ips.length > 0 ? ips[0] : "localhost";
}

let mainWindow = null;
let apiProcess = null;
let runtimeInfo = null;
let backupTimer = null;

function readPackagedRole() {
  if (process.env.ELECTRON_ROLE) return process.env.ELECTRON_ROLE;
  try {
    // In packaged apps package.json can still be resolved from app path.
    const metadata = require(path.join(app.getAppPath(), "package.json"));
    return metadata.pmsRole;
  } catch {
    return undefined;
  }
}

function getDefaultNetworkConfig() {
  return {
    mode: readPackagedRole() === "client" ? "client" : "host",
    apiProtocol: "http",
    apiHost: "localhost",
    apiPort: 3003,
  };
}

function getNetworkConfigPath() {
  return path.join(app.getPath("userData"), "network-config.json");
}

function loadNetworkConfig() {
  const configPath = getNetworkConfigPath();
  const defaults = getDefaultNetworkConfig();
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      mode: parsed.mode === "client" ? "client" : "host",
      apiProtocol: parsed.apiProtocol === "https" ? "https" : "http",
      apiHost: typeof parsed.apiHost === "string" && parsed.apiHost.trim() ? parsed.apiHost.trim() : defaults.apiHost,
      apiPort: Number.isInteger(parsed.apiPort) ? parsed.apiPort : defaults.apiPort,
    };
  } catch {
    return defaults;
  }
}

function saveNetworkConfig(config) {
  fs.writeFileSync(getNetworkConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

function getApiBaseUrl(config) {
  const host = config.mode === "host" ? "localhost" : config.apiHost;
  return `${config.apiProtocol}://${host}:${config.apiPort}`;
}

async function checkApiReachable(baseUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`${baseUrl}/api/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

function getDbPath() {
  const programData = process.env.PROGRAMDATA || "C:\\ProgramData";
  return process.env.DATABASE_PATH || path.join(programData, "PalawanSU-Hotel", "db", "petrocorex.db");
}

function ensureBackupsDir() {
  const dir = path.join(app.getPath("userData"), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listBackups() {
  const dir = ensureBackupsDir();
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      return { name, path: fullPath, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createBackupNow() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(ensureBackupsDir(), `petrocorex-${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function scheduleDailyBackup(mode) {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  if (mode !== "host") return;

  // Run once shortly after startup, then every 24h.
  setTimeout(() => {
    try {
      const backupPath = createBackupNow();
      console.log(`[Backup] Startup backup created: ${backupPath}`);
    } catch (err) {
      console.warn(`[Backup] Startup backup skipped: ${err.message}`);
    }
  }, 15000);

  backupTimer = setInterval(() => {
    try {
      const backupPath = createBackupNow();
      console.log(`[Backup] Daily backup created: ${backupPath}`);
    } catch (err) {
      console.warn(`[Backup] Daily backup failed: ${err.message}`);
    }
  }, 24 * 60 * 60 * 1000);
}

async function restoreBackupViaDialog() {
  const result = await dialog.showOpenDialog({
    title: "Select a backup file to restore",
    properties: ["openFile"],
    filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
  });
  if (result.canceled || !result.filePaths.length) {
    return { restored: false, reason: "cancelled" };
  }
  const selectedPath = result.filePaths[0];
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.copyFileSync(selectedPath, dbPath);
  return { restored: true, source: selectedPath, target: dbPath };
}

function registerIpcHandlers() {
  ipcMain.handle("pms:get-runtime-info", async () => runtimeInfo);
  ipcMain.handle("pms:get-network-config", async () => {
    const config = loadNetworkConfig();
    return {
      ...config,
      deviceIp: getLocalIpAddress(),
      allIps: getAllIpAddresses()
    };
  });
  ipcMain.handle("pms:set-network-config", async (_event, incoming) => {
    const current = loadNetworkConfig();
    const next = {
      mode: incoming?.mode === "client" ? "client" : "host",
      apiProtocol: incoming?.apiProtocol === "https" ? "https" : "http",
      apiHost: typeof incoming?.apiHost === "string" && incoming.apiHost.trim() ? incoming.apiHost.trim() : current.apiHost,
      apiPort: Number.isInteger(Number(incoming?.apiPort)) ? Number(incoming.apiPort) : current.apiPort,
    };
    saveNetworkConfig(next);
    return next;
  });
  ipcMain.handle("pms:get-backups", async () => listBackups());
  ipcMain.handle("pms:create-backup", async () => {
    const backupPath = createBackupNow();
    return { backupPath };
  });
  ipcMain.handle("pms:restore-backup-dialog", async () => restoreBackupViaDialog());
  ipcMain.handle("pms:restore-backup", async (_event, backupPath) => {
    if (!backupPath || !fs.existsSync(backupPath)) {
      return { restored: false, reason: "Backup file does not exist" };
    }
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(backupPath, dbPath);
    return { restored: true, target: dbPath };
  });
  
  ipcMain.on("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => {
    mainWindow?.close();
  });
}

// ---------------------------------------------------------------------------
// API Server
// ---------------------------------------------------------------------------

function startApiServer(config) {
  return new Promise((resolve) => {
    if (config.mode === "client") {
      console.log("[Electron] Client mode enabled — local API server disabled.");
      resolve();
      return;
    }

    const API_PORT = config.apiPort;

    if (isDev) {
      // In dev mode the API server is expected to be running already
      // (started by the workspace workflow or manually)
      console.log(`[Electron] Dev mode — assuming API server is already running on port ${API_PORT}`);
      resolve();
      return;
    }

    // Production: start the bundled server using Electron's built-in Node
    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave like plain node
    const serverPath = path.join(
      process.resourcesPath,
      "server",
      "index.cjs"
    );

    console.log(`[Electron] Starting API server from ${serverPath}`);

    const dbPath = getDbPath();

    apiProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(API_PORT),
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
        DATABASE_PATH: dbPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    apiProcess.stdout?.on("data", (data) => {
      const text = data.toString().trim();
      console.log(`[API] ${text}`);
      if (!resolved && text.includes("listening")) {
        resolved = true;
        resolve();
      }
    });

    apiProcess.stderr?.on("data", (data) => {
      console.error(`[API Error] ${data.toString().trim()}`);
    });

    apiProcess.on("error", (err) => {
      console.error("[Electron] Failed to start API server:", err.message);
      if (!resolved) { resolved = true; resolve(); }
    });

    // Safety timeout — open the window even if server takes long
    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 8000);
  });
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow() {
  const preloadEnv = {
    API_PORT: String(runtimeInfo.apiPort),
    API_BASE_URL: runtimeInfo.apiBaseUrl,
    APP_MODE: runtimeInfo.mode,
    HOST_REACHABLE: runtimeInfo.hostReachable ? "true" : "false",
  };
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, "..", "public", "logo.png"),
    backgroundColor: "#0f172a",
    frame: false,
    titleBarStyle: "hidden",
    title: "PalawanSU Hotel",
    autoHideMenuBar: true,
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: Object.entries(preloadEnv).map(([key, value]) => `--${key}=${value}`),
      nodeIntegration: false,
      contextIsolation: true,
      // Temporarily disable webSecurity to rule out file permission issues
      webSecurity: false, 
    },
  });

  // Show window when it's ready to handle the white-screen flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Remove default application menu (keeps native OS window controls)
  Menu.setApplicationMenu(null);

  if (isDev) {
    // In dev, load the Vite dev server
    const devPort = process.env.VITE_PORT || "5173";
    mainWindow.loadURL(`http://localhost:${devPort}/`);
  } else {
    // In production, load the built React app from disk
    const indexPath = path.join(app.getAppPath(), "dist", "public", "index.html");
    
    // Diagnostic check for file existence
    const fs = require("fs");
    if (!fs.existsSync(indexPath)) {
      console.error(`[Electron] ERROR: Index file not found at ${indexPath}`);
      // Fallback to __dirname just in case getAppPath() is shifting
      const fallbackPath = path.join(__dirname, "..", "dist", "public", "index.html");
      console.log(`[Electron] Trying fallback path: ${fallbackPath}`);
      mainWindow.loadFile(fallbackPath);
    } else {
      console.log(`[Electron] Loading production index from: ${indexPath}`);
      mainWindow.loadFile(indexPath);
    }
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  const config = loadNetworkConfig();
  await startApiServer(config);
  scheduleDailyBackup(config.mode);
  const apiBaseUrl = getApiBaseUrl(config);
  const hostReachable = await checkApiReachable(apiBaseUrl);
  runtimeInfo = {
    mode: config.mode,
    apiPort: config.apiPort,
    apiHost: config.apiHost,
    apiBaseUrl,
    hostReachable,
  };
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
});
