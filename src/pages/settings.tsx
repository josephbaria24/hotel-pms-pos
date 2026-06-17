import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { applyUiScale, getStoredUiScale, resetUiScale, uiScaleConfig } from "@/lib/ui-scale";
import { cn } from "@/lib/utils";
import { formatPhDateTime } from "@/lib/datetime";
import { Loader2, Wifi, ShieldCheck } from "lucide-react";

interface ConnectionStatus {
  serverConnected: boolean;
  databaseConnected: boolean;
  hostActive: boolean;
  connectedClients: number;
  updatedAt: string;
}

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettingsMutation = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isElectron = !!window.__ELECTRON__?.isElectron;
  const [networkConfig, setNetworkConfig] = useState<ElectronNetworkConfig | null>(null);
  const [isSavingNetwork, setIsSavingNetwork] = useState(false);
  const [backups, setBackups] = useState<Array<{ name: string; path: string; size: number; createdAt: string }>>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isCheckingConnections, setIsCheckingConnections] = useState(false);
  const [uiScalePercent, setUiScalePercent] = useState(() => Math.round(getStoredUiScale() * 100));
  const [generalForm, setGeneralForm] = useState({
    hotelName: "",
    address: "",
    contactNumber: "",
    email: "",
  });
  const [policyForm, setPolicyForm] = useState({
    checkInTime: "14:00",
    checkOutTime: "12:00",
    currency: "Peso",
    taxRate: 0,
  });
  const [activeSection, setActiveSection] = useState<"basic" | "policies" | "appearance" | "connections">(
    "basic",
  );

  function getClientId() {
    const key = "pms_client_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created =
      globalThis.crypto?.randomUUID?.() ??
      `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, created);
    return created;
  }

  function resolveApiBaseUrl() {
    if (window.__ELECTRON__?.isElectron) {
      if (window.__PMS_RUNTIME__?.apiBaseUrl) return window.__PMS_RUNTIME__.apiBaseUrl;
      if (window.__ELECTRON__?.apiBaseUrl) return window.__ELECTRON__.apiBaseUrl;
      return "http://localhost:3003";
    }
    if (window.location.protocol.startsWith("http")) return window.location.origin;
    return "http://localhost:3003";
  }

  async function checkConnections() {
    const baseUrl = resolveApiBaseUrl();
    setIsCheckingConnections(true);
    try {
      await fetch(`${baseUrl}/api/connections/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId() }),
      });

      const response = await fetch(`${baseUrl}/api/connections/status`);
      if (!response.ok) {
        throw new Error("Status request failed");
      }
      const status = (await response.json()) as ConnectionStatus;
      setConnectionStatus(status);
    } catch {
      setConnectionStatus({
        serverConnected: false,
        databaseConnected: false,
        hostActive: false,
        connectedClients: 0,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsCheckingConnections(false);
    }
  }

  async function loadBackups() {
    if (!window.__ELECTRON__?.getBackups) return;
    const rows = await window.__ELECTRON__.getBackups();
    setBackups(rows);
  }

  useEffect(() => {
    if (!isElectron) return;
    window.__ELECTRON__?.getNetworkConfig?.().then(setNetworkConfig).catch(() => {
      toast({
        title: "Could not load network config",
        description: "Using defaults. Check Electron logs for details.",
        variant: "destructive",
      });
    });
    loadBackups().catch(() => { });
  }, [isElectron, toast]);

  useEffect(() => {
    if (!isElectron) return;
    checkConnections().catch(() => { });
    const timer = setInterval(() => {
      checkConnections().catch(() => { });
    }, 10000);
    return () => clearInterval(timer);
  }, [isElectron]);

  useEffect(() => {
    if (!settings) return;
    setGeneralForm({
      hotelName: settings.hotelName ?? "",
      address: settings.address ?? "",
      contactNumber: settings.contactNumber ?? "",
      email: settings.email ?? "",
    });
    setPolicyForm({
      checkInTime: settings.checkInTime ?? "14:00",
      checkOutTime: settings.checkOutTime ?? "12:00",
      currency: settings.currency ?? "Peso",
      taxRate: Number(settings.taxRate ?? 0),
    });
  }, [settings]);

  async function saveNetworkConfig() {
    if (!networkConfig || !window.__ELECTRON__?.setNetworkConfig) return;
    setIsSavingNetwork(true);
    try {
      const saved = await window.__ELECTRON__.setNetworkConfig(networkConfig);
      setNetworkConfig(saved);
      toast({
        title: "Network config saved",
        description: "Restart the desktop app so the new API target is applied.",
      });
    } catch {
      toast({
        title: "Save failed",
        description: "Could not save network config.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNetwork(false);
    }
  }

  async function createBackup() {
    if (!window.__ELECTRON__?.createBackup) return;
    setIsBackingUp(true);
    try {
      const result = await window.__ELECTRON__.createBackup();
      toast({
        title: "Backup created",
        description: `Saved to ${result.backupPath}`,
      });
      await loadBackups();
    } catch {
      toast({
        title: "Backup failed",
        description: "Could not create backup. Ensure host mode and DB file exist.",
        variant: "destructive",
      });
    } finally {
      setIsBackingUp(false);
    }
  }

  async function restoreBackup() {
    if (!window.__ELECTRON__?.restoreBackupDialog) return;
    setIsRestoring(true);
    try {
      const result = await window.__ELECTRON__.restoreBackupDialog();
      if (!result.restored) {
        return;
      }
      toast({
        title: "Backup restored",
        description: "Database restored. Restart backend/app for clean reload.",
      });
    } catch {
      toast({
        title: "Restore failed",
        description: "Could not restore backup.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  async function restoreSpecific(backupPath: string) {
    if (!window.__ELECTRON__?.restoreSpecificBackup) return;
    const confirmed = window.confirm("⚠️ WARNING: Restoring this backup will replace all active database data. Are you sure you want to proceed?");
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const result = await window.__ELECTRON__.restoreSpecificBackup(backupPath);
      if (result.restored) {
        toast({
          title: "Backup Restored! 📂",
          description: "Database restored successfully. Please restart the app for a clean reload.",
        });
      } else {
        toast({
          title: "Restore Failed",
          description: result.reason || "Could not restore the selected backup.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Restore Failed",
        description: "An unexpected error occurred during database restoration.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  function handleUiScaleChange(nextPercent: number) {
    const clampedPercent = Math.min(uiScaleConfig.max * 100, Math.max(uiScaleConfig.min * 100, nextPercent));
    setUiScalePercent(clampedPercent);
    applyUiScale(clampedPercent / 100);
  }

  function handleResetUiScale() {
    resetUiScale();
    setUiScalePercent(Math.round(uiScaleConfig.default * 100));
    toast({
      title: "Display scale reset",
      description: "UI scale is back to 100%.",
    });
  }

  async function saveGeneralSettings() {
    try {
      await updateSettingsMutation.mutateAsync(generalForm);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "General settings saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save settings.",
        variant: "destructive",
      });
    }
  }

  async function savePolicySettings() {
    try {
      await updateSettingsMutation.mutateAsync(policyForm);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Policies saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save policies.",
        variant: "destructive",
      });
    }
  }

  const [isScanningNetwork, setIsScanningNetwork] = useState(false);

  async function scanLocalNetwork() {
    if (!networkConfig || !networkConfig.deviceIp) {
      toast({
        title: "Scan failed",
        description: "Could not determine local device IP to identify subnet.",
        variant: "destructive"
      });
      return;
    }

    const detectedIps = networkConfig.allIps && networkConfig.allIps.length > 0
      ? networkConfig.allIps
      : [networkConfig.deviceIp];

    // Self-healing fallback: also scan standard home/office physical Wi-Fi subnets 
    // to handle virtual adapters or cases where the Electron process wasn't restarted.
    const clientIps = [...detectedIps];
    const commonSubnets = ["192.168.1.1", "192.168.0.1", "192.168.2.1", "10.0.0.1", "192.168.254.1"];
    
    for (const common of commonSubnets) {
      const commonPrefix = common.substring(0, common.lastIndexOf("."));
      const alreadyHas = clientIps.some(ip => ip.startsWith(commonPrefix));
      if (!alreadyHas) {
        clientIps.push(common);
      }
    }

    setIsScanningNetwork(true);
    const port = networkConfig.apiPort || 3003;
    let foundIp: string | null = null;
    const scannedSubnets: string[] = [];

    try {
      // Loop over every active network interface subnet
      for (const clientIp of clientIps) {
        if (foundIp) break;

        const parts = clientIp.split(".");
        if (parts.length !== 4) continue;

        const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        scannedSubnets.push(`${subnetPrefix}.X`);

        const chunkSize = 64;
        
        // Scan in chunks of 64 to avoid overloading sockets
        for (let batch = 0; batch < 4; batch++) {
          if (foundIp) break;

          const batchPromises: Promise<string | null>[] = [];
          const start = batch * chunkSize + 1;
          const end = Math.min(254, (batch + 1) * chunkSize);

          for (let i = start; i <= end; i++) {
            const targetIp = `${subnetPrefix}.${i}`;
            if (targetIp === clientIp) continue;

            const checkHost = async (): Promise<string | null> => {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                  try { controller.abort(); } catch { }
                }, 600); // 600ms is standard for LAN sweeping

                const res = await fetch(`${networkConfig.apiProtocol || "http"}://${targetIp}:${port}/api/connections/status`, {
                  signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                  const data = await res.json();
                  if (data && (data.serverConnected !== undefined || data.databaseConnected !== undefined || data.hostActive !== undefined)) {
                    return targetIp;
                  }
                }
              } catch {
                // Ignore unreachable host
              }
              return null;
            };

            batchPromises.push(checkHost());
          }

          const results = await Promise.all(batchPromises);
          foundIp = results.find((ip) => ip !== null) || null;
        }
      }

      if (foundIp) {
        const hostIp: string = foundIp;
        setNetworkConfig((prev) => prev ? { ...prev, apiHost: hostIp } : prev);
        toast({
          title: "Host Server Found! 🔍",
          description: `Successfully discovered active PalawanSU Hotel Server at ${foundIp}.`,
        });
      } else {
        toast({
          title: "No Host Server Found",
          description: `Scanned subnets (${scannedSubnets.join(", ")}) on port ${port} but no active server was found. Please verify the Host PC is running.`,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "An error occurred during scanning.",
        variant: "destructive"
      });
    } finally {
      setIsScanningNetwork(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage configuration, policies, and desktop operations.</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] min-h-[680px]">
          <aside className="border-r border-border/70 p-3 space-y-1 bg-muted/30">
            {[
              { id: "basic", label: "Basic Info", description: "Hotel profile" },
              { id: "policies", label: "Policies & Billing", description: "Currency and tax" },
              { id: "appearance", label: "Appearance", description: "Scale and density" },
              ...(isElectron
                ? [{ id: "connections", label: "Connection & Backup", description: "Host utilities" }]
                : []),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as typeof activeSection)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2 transition-colors",
                  activeSection === item.id
                    ? "bg-black/10 text-foreground dark:bg-white/20 dark:text-foreground"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
                )}
              >
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </button>
            ))}
          </aside>

          <section className="p-4 space-y-4 overflow-y-auto">
            {activeSection === "basic" && (
              <Card className="border border-border/70 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle>General Information</CardTitle>
                  <CardDescription>Basic details about the property.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Hotel Name</Label>
                          <Input
                            value={generalForm.hotelName}
                            onChange={(e) =>
                              setGeneralForm((prev) => ({ ...prev, hotelName: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Contact Number</Label>
                          <Input
                            value={generalForm.contactNumber}
                            onChange={(e) =>
                              setGeneralForm((prev) => ({ ...prev, contactNumber: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Address</Label>
                        <Input
                          value={generalForm.address}
                          onChange={(e) =>
                            setGeneralForm((prev) => ({ ...prev, address: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                          value={generalForm.email}
                          onChange={(e) => setGeneralForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={saveGeneralSettings} disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "policies" && (
              <Card className="border border-border/70 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle>Operational Policies</CardTitle>
                  <CardDescription>Check-in times and billing rules.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label>Check-in Time</Label>
                          <Input
                            type="time"
                            value={policyForm.checkInTime}
                            onChange={(e) =>
                              setPolicyForm((prev) => ({ ...prev, checkInTime: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Check-out Time</Label>
                          <Input
                            type="time"
                            value={policyForm.checkOutTime}
                            onChange={(e) =>
                              setPolicyForm((prev) => ({ ...prev, checkOutTime: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Currency</Label>
                          <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={policyForm.currency}
                            onChange={(e) =>
                              setPolicyForm((prev) => ({ ...prev, currency: e.target.value }))
                            }
                          >
                            <option value="USD">USD ($)</option>
                            <option value="Peso">Peso (₱)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Tax Rate (%)</Label>
                          <Input
                            type="number"
                            value={policyForm.taxRate}
                            onChange={(e) =>
                              setPolicyForm((prev) => ({
                                ...prev,
                                taxRate: Number(e.target.value || "0"),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={savePolicySettings} disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving..." : "Save Policies"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "appearance" && (
              <Card className="border border-border/70 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle>Display Scale</CardTitle>
                  <CardDescription>Adjust overall UI size and density.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>UI Scale ({uiScalePercent}%)</Label>
                    <Input
                      type="range"
                      min={uiScaleConfig.min * 100}
                      max={uiScaleConfig.max * 100}
                      step={5}
                      value={uiScalePercent}
                      onChange={(e) => handleUiScaleChange(Number(e.target.value))}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.round(uiScaleConfig.min * 100)}%</span>
                      <span>100%</span>
                      <span>{Math.round(uiScaleConfig.max * 100)}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      size="sm"
                      variant={uiScalePercent === 90 ? "default" : "outline"}
                      onClick={() => handleUiScaleChange(90)}
                    >
                      90%
                    </Button>
                    <Button
                      size="sm"
                      variant={uiScalePercent === 100 ? "default" : "outline"}
                      onClick={() => handleUiScaleChange(100)}
                    >
                      100%
                    </Button>
                    <Button
                      size="sm"
                      variant={uiScalePercent === 110 ? "default" : "outline"}
                      onClick={() => handleUiScaleChange(110)}
                    >
                      110%
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleResetUiScale}>
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "connections" && isElectron && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle>Connection Checker</CardTitle>
                    <CardDescription>
                      Live status for host, server, database, and connected clients on this LAN.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Client App</div>
                        <div className="font-semibold">Connected</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Host Active</div>
                        <div
                          className={
                            connectionStatus?.hostActive
                              ? "font-semibold text-green-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {connectionStatus?.hostActive ? "Online" : "Offline"}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">API Server</div>
                        <div
                          className={
                            connectionStatus?.serverConnected
                              ? "font-semibold text-green-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {connectionStatus?.serverConnected ? "Connected" : "Disconnected"}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Database</div>
                        <div
                          className={
                            connectionStatus?.databaseConnected
                              ? "font-semibold text-green-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {connectionStatus?.databaseConnected ? "Connected" : "Disconnected"}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Clients Connected</div>
                        <div className="font-semibold">{connectionStatus?.connectedClients ?? 0}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={checkConnections}
                        disabled={isCheckingConnections}
                      >
                        {isCheckingConnections ? "Checking..." : "Check Connections Now"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Last checked:{" "}
                        {connectionStatus ? formatPhDateTime(connectionStatus.updatedAt) : "Not yet"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>LAN Server Configuration</CardTitle>
                    <CardDescription>
                      Host mode runs local server+DB. Client mode points to host PC static IP or local
                      DNS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!networkConfig ? (
                      <Skeleton className="h-28 w-full" />
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Mode</Label>
                          <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                            value={networkConfig.mode}
                            onChange={(e) =>
                              setNetworkConfig({
                                ...networkConfig,
                                mode: e.target.value as "host" | "client",
                              })
                            }
                          >
                            <option value="host">Host (server + database on this PC)</option>
                            <option value="client">Client (connect to host on LAN)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>Protocol</Label>
                            <select
                              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={networkConfig.apiProtocol}
                              onChange={(e) =>
                                setNetworkConfig({
                                  ...networkConfig,
                                  apiProtocol: e.target.value as "http" | "https",
                                })
                              }
                            >
                              <option value="http">http</option>
                              <option value="https">https</option>
                            </select>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <div className="flex justify-between items-center">
                              <Label>Host IP / DNS</Label>
                              {networkConfig.deviceIp && (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={scanLocalNetwork}
                                    disabled={isScanningNetwork}
                                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isScanningNetwork ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Scanning Wi-Fi...
                                      </>
                                    ) : (
                                      <>
                                        <Wifi className="h-3 w-3" />
                                        Scan Wi-Fi for Host
                                      </>
                                    )}
                                  </button>
                                  <span className="text-[10px] text-muted-foreground/45">|</span>
                                  <button
                                    type="button"
                                    onClick={() => setNetworkConfig({ ...networkConfig, apiHost: networkConfig.deviceIp || "localhost" })}
                                    className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-semibold cursor-pointer"
                                  >
                                    Use My IP
                                  </button>
                                </div>
                              )}
                            </div>
                            <Input
                              value={networkConfig.apiHost}
                              onChange={(e) =>
                                setNetworkConfig({ ...networkConfig, apiHost: e.target.value })
                              }
                              placeholder="192.168.1.10 or pms-host.local"
                            />
                            {networkConfig.deviceIp && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Current device IP: <span className="font-mono text-foreground font-semibold">{networkConfig.deviceIp}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Port</Label>
                          <Input
                            type="number"
                            value={networkConfig.apiPort}
                            onChange={(e) =>
                              setNetworkConfig({
                                ...networkConfig,
                                apiPort: Number(e.target.value || "3001"),
                              })
                            }
                          />
                        </div>

                        <Button onClick={saveNetworkConfig} disabled={isSavingNetwork}>
                          {isSavingNetwork ? "Saving..." : "Save Network Config"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Backup & Restore</CardTitle>
                    <CardDescription>
                      Use on host PC. Daily backup files are stored in app data backups folder.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <Button onClick={createBackup} disabled={isBackingUp}>
                        {isBackingUp ? "Creating backup..." : "Create Backup Now"}
                      </Button>
                      <Button variant="outline" onClick={restoreBackup} disabled={isRestoring}>
                        {isRestoring ? "Restoring..." : "Restore Backup"}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Available Backups</Label>
                        <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Daily Auto-Backups: Active
                        </span>
                      </div>
                      <div className="max-h-48 overflow-auto rounded-md border border-border p-2 text-sm space-y-1">
                        {backups.length === 0 ? (
                          <p className="text-muted-foreground text-xs">No daily backup files yet.</p>
                        ) : (
                          backups.map((backup) => (
                            <div
                              key={backup.path}
                              className="flex justify-between items-center py-1.5 text-xs border-b border-border/60 last:border-0"
                            >
                              <div>
                                <div className="font-semibold text-foreground">{backup.name}</div>
                                <div className="text-[10px] text-muted-foreground/80">
                                  {formatPhDateTime(backup.createdAt)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10 border-primary/20 hover:border-primary/40 cursor-pointer disabled:opacity-50"
                                onClick={() => restoreSpecific(backup.path)}
                                disabled={isRestoring}
                              >
                                Restore
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
