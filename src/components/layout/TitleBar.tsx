import React, { useEffect, useMemo, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionStatus {
  serverConnected: boolean;
  databaseConnected: boolean;
  hostActive: boolean;
  connectedClients: number;
  updatedAt: string;
}

export function TitleBar() {
  const isElectron = !!window.__ELECTRON__?.isElectron;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  const handleMinimize = () => {
    if (typeof window.__ELECTRON__?.minimize === "function") {
      window.__ELECTRON__.minimize();
    }
  };
  const handleMaximize = () => {
    if (typeof window.__ELECTRON__?.maximize === "function") {
      window.__ELECTRON__.maximize();
    }
  };
  const handleClose = () => {
    if (typeof window.__ELECTRON__?.close === "function") {
      window.__ELECTRON__.close();
    }
  };

  const resolveApiBaseUrl = () => {
    const runtimeBaseUrl = (window as any).__PMS_RUNTIME__?.apiBaseUrl;
    if (runtimeBaseUrl) return runtimeBaseUrl;
    if (window.__ELECTRON__?.apiBaseUrl) return window.__ELECTRON__.apiBaseUrl;
    if (window.__ELECTRON__?.apiPort) return `http://localhost:${window.__ELECTRON__.apiPort}`;
    return "http://localhost:3003";
  };

  const getClientId = () => {
    const key = "pms_client_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created =
      globalThis.crypto?.randomUUID?.() ??
      `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, created);
    return created;
  };

  useEffect(() => {
    if (!isElectron) return;
    let isMounted = true;
    const run = async () => {
      const baseUrl = resolveApiBaseUrl();
      try {
        await fetch(`${baseUrl}/api/connections/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: getClientId() }),
        });
        const response = await fetch(`${baseUrl}/api/connections/status`);
        if (!response.ok) throw new Error("status failed");
        const status = (await response.json()) as ConnectionStatus;
        if (isMounted) setConnectionStatus(status);
      } catch {
        if (isMounted) {
          setConnectionStatus({
            serverConnected: false,
            databaseConnected: false,
            hostActive: false,
            connectedClients: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    };

    run();
    const timer = setInterval(run, 10000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isElectron]);

  const aggregatedStatus = useMemo(() => {
    const checks = [
      connectionStatus?.hostActive ?? false,
      connectionStatus?.serverConnected ?? false,
      connectionStatus?.databaseConnected ?? false,
    ];
    const allGood = checks.every(Boolean);
    const allFailed = checks.every((ok) => !ok);

    if (allGood) {
      return {
        label: "Connected",
        dot: "bg-emerald-500",
        text: "text-emerald-300",
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/10",
      };
    }
    if (allFailed) {
      return {
        label: "Disconnected",
        dot: "bg-red-500",
        text: "text-red-300",
        border: "border-red-500/40",
        bg: "bg-red-500/10",
      };
    }
    return {
      label: "Partial",
      dot: "bg-amber-500",
      text: "text-amber-300",
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
    };
  }, [connectionStatus]);

  if (!isElectron) return null;

  return (
    <div 
      className="h-9 w-full bg-sidebar flex items-center justify-between select-none border-b border-sidebar-border/30"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex items-center gap-2 px-4">
        <div className="h-4 w-4 flex items-center justify-center">
          <img src="logo.png" alt="Icon" className="w-full h-full object-contain" />
        </div>
        <span className="text-[11px] font-semibold text-sidebar-foreground/80 tracking-tight">PalawanSU Hotel</span>
        <div className="no-drag" style={{ WebkitAppRegion: "no-drag" } as any}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] ${aggregatedStatus.text} ${aggregatedStatus.border} ${aggregatedStatus.bg}`}
              >
                <span className={`h-2 w-2 rounded-full ${aggregatedStatus.dot}`} />
                {aggregatedStatus.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="text-xs bg-background border-border text-foreground">
              <div className="space-y-1 min-w-[210px]">
                <div className="font-semibold mb-1">Connection Status</div>
                <div className="flex items-center justify-between gap-4">
                  <span>Client App</span>
                  <span className="text-emerald-400">Connected</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Host Active</span>
                  <span className={connectionStatus?.hostActive ? "text-emerald-400" : "text-red-400"}>
                    {connectionStatus?.hostActive ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>API Server</span>
                  <span className={connectionStatus?.serverConnected ? "text-emerald-400" : "text-red-400"}>
                    {connectionStatus?.serverConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Database</span>
                  <span className={connectionStatus?.databaseConnected ? "text-emerald-400" : "text-red-400"}>
                    {connectionStatus?.databaseConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-muted-foreground pt-1">
                  <span>Clients</span>
                  <span>{connectionStatus?.connectedClients ?? 0}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div 
        className="flex items-center h-full no-drag"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <button 
          onClick={handleMinimize}
          className="h-full px-3 flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button 
          onClick={handleMaximize}
          className="h-full px-3 flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Square className="h-3 w-3" />
        </button>
        <button 
          onClick={handleClose}
          className="h-full px-3 flex items-center justify-center text-sidebar-foreground/60 hover:bg-destructive hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
