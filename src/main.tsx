import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "sileo/styles.css";
import { setBaseUrl } from "@workspace/api-client-react";

// When running inside Electron, the app is loaded from file:// so relative
// API paths like /api/... won't work. The preload script exposes
// window.__ELECTRON__ with the API port so we can build the absolute URL.
declare global {
  interface ElectronRuntimeInfo {
    mode: "host" | "client";
    apiPort: number;
    apiHost: string;
    apiBaseUrl: string;
    hostReachable: boolean;
  }

  interface ElectronNetworkConfig {
    mode: "host" | "client";
    apiProtocol: "http" | "https";
    apiHost: string;
    apiPort: number;
    deviceIp?: string;
    allIps?: string[];
  }

  interface Window {
    __ELECTRON__?: {
      isElectron: boolean;
      apiPort: number;
      apiBaseUrl: string;
      appMode: "host" | "client";
      hostReachable: boolean;
      platform: string;
      version: string;
      getRuntimeInfo?: () => Promise<ElectronRuntimeInfo | null>;
      getNetworkConfig?: () => Promise<ElectronNetworkConfig>;
      setNetworkConfig?: (config: ElectronNetworkConfig) => Promise<ElectronNetworkConfig>;
      getBackups?: () => Promise<Array<{ name: string; path: string; size: number; createdAt: string }>>;
      createBackup?: () => Promise<{ backupPath: string }>;
      restoreBackupDialog?: () => Promise<{ restored: boolean; reason?: string; source?: string; target?: string }>;
      restoreSpecificBackup?: (backupPath: string) => Promise<{ restored: boolean; reason?: string; target?: string }>;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
    };
    __PMS_RUNTIME__?: ElectronRuntimeInfo | null;
  }
}

async function bootstrap() {
  if (window.__ELECTRON__?.isElectron) {
    const fallbackBase = window.__ELECTRON__.apiBaseUrl || `http://localhost:${window.__ELECTRON__.apiPort}`;
    const runtime = await window.__ELECTRON__.getRuntimeInfo?.();
    const baseUrl = runtime?.apiBaseUrl || fallbackBase;
    setBaseUrl(baseUrl);
    window.__PMS_RUNTIME__ = runtime ?? null;
    console.info(`[PalawanSU Hotel] Running in Electron — API base: ${baseUrl}`);
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

// Diagnostic Alert for Production Crashes
window.onerror = (message, source, lineno, colno, error) => {
  const msg = `CRASH: ${message}\nAt: ${source}:${lineno}:${colno}\nError: ${JSON.stringify(error)}`;
  alert(msg);
  console.error(msg);
  return false;
};

bootstrap();
