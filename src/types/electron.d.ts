export {};

type ElectronNetworkConfig = {
  mode?: string;
  hostUrl?: string;
  apiPort?: number;
  deviceIp?: string;
  allIps?: string[];
  bindHost?: string;
  [key: string]: string | number | string[] | boolean | undefined;
};

type ElectronBackupRow = {
  name: string;
  path: string;
  size: number;
  createdAt: string;
};

declare global {
  interface Window {
    __ELECTRON__?: {
      isElectron?: boolean;
      apiBaseUrl?: string;
      apiPort?: number;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      getBackups?: () => Promise<ElectronBackupRow[]>;
      getNetworkConfig?: () => Promise<ElectronNetworkConfig>;
      setNetworkConfig?: (
        config: ElectronNetworkConfig,
      ) => Promise<ElectronNetworkConfig>;
      // Electron IPC payloads vary; keep loose for the web port.
      createBackup?: () => Promise<any>;
      restoreBackupDialog?: () => Promise<any>;
      restoreSpecificBackup?: (path: string) => Promise<any>;
      scanNetworkHosts?: () => Promise<any>;
      getConnectionStatus?: () => Promise<any>;
    };
    __PMS_RUNTIME__?: {
      mode?: "host" | "client" | string;
      hostReachable?: boolean;
      apiBaseUrl?: string;
    };
  }
}
