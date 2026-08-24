"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  ClipboardList,
  LayoutGrid,
  Menu,
  Moon,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  Sun,
  Tags,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DashboardIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <path
      fill="currentColor"
      d="M15.21 2H8.75A6.76 6.76 0 0 0 2 8.75v6.5A6.76 6.76 0 0 0 8.75 22h6.5A6.76 6.76 0 0 0 22 15.25v-6.5A6.76 6.76 0 0 0 15.21 2m1.89 10.69h-.14a.76.76 0 0 1-.74-.62l-.18-1l-1.31 2a1.71 1.71 0 0 1-2.32.5l-2.27-1.44a.18.18 0 0 0-.13 0a.2.2 0 0 0-.13.08L7.56 15.3a.77.77 0 0 1-.6.3a.74.74 0 0 1-.45-.15a.75.75 0 0 1-.15-1l2.32-3.09a1.71 1.71 0 0 1 2.25-.43l2.28 1.44a.23.23 0 0 0 .28-.06l1.34-2l-1.08.15a.753.753 0 0 1-.28-1.48l2.76-.51h.36a.12.12 0 0 1 .08 0l.15.08l.15.12q.054.065.09.14a.5.5 0 0 1 .06.15l.52 2.8a.75.75 0 0 1-.54.93"
    />
  </svg>
);

const RoomsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <path fill="currentColor" d="M16.5 12h-9c-.55 0-1 .45-1 1v1h11v-1c0-.55-.45-1-1-1M7.25 8.5h4v2h-4zm5.5 0h4v2h-4z" />
    <path
      fill="currentColor"
      d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-1 15h-1.5v-1.5h-11V17H5v-3.83c0-.66.25-1.26.65-1.72V9c0-1.1.9-2 2-2H11c.37 0 .72.12 1 .32c.28-.2.63-.32 1-.32h3.35c1.1 0 2 .9 2 2v2.45c.4.46.65 1.06.65 1.72z"
    />
  </svg>
);

const GuestsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" className={className}>
    <path
      fill="currentColor"
      d="M4.25 3.25a1.75 1.75 0 1 1 3.5 0a1.75 1.75 0 0 1-3.5 0m-2 2.25a1.25 1.25 0 1 0 0-2.5a1.25 1.25 0 0 0 0 2.5M11 4.25a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0M5.25 6C4.56 6 4 6.56 4 7.25V8.5a2 2 0 1 0 4 0V7.25C8 6.56 7.44 6 6.75 6zM3 7.25c0-.289.054-.565.154-.818l-1.231.33a1.25 1.25 0 0 0-.884 1.53l.194.725a2 2 0 0 0 2.45 1.414l.017-.005A3 3 0 0 1 3 8.5zM9 8.5c0 .733-.263 1.405-.7 1.927l.016.004a2 2 0 0 0 2.449-1.414l.194-.725a1.25 1.25 0 0 0-.884-1.53l-1.228-.33c.099.254.153.53.153.818z"
    />
  </svg>
);

const BillingIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <g fill="none" fillRule="evenodd">
      <path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z" />
      <path
        fill="currentColor"
        d="M18 3a3 3 0 0 1 2.995 2.824L21 6v14a1 1 0 0 1-1.405.914l-.12-.062l-2.725-1.678l-2.726 1.678a1 1 0 0 1-.938.058l-.11-.058l-2.726-1.678l-2.726 1.678a1 1 0 0 1-1.517-.732L6 20v-6H4a1 1 0 0 1-.993-.883L3 13V5.5a2.5 2.5 0 0 1 2.336-2.495L5.5 3zm-3 9h-4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2M5.5 5a.5.5 0 0 0-.5.5V12h1V5.5a.5.5 0 0 0-.5-.5M16 8h-5a1 1 0 0 0-.117 1.993L11 10h5a1 1 0 0 0 .117-1.993z"
      />
    </g>
  </svg>
);

const ReportsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className}>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.646 2.191C12.526 1.855 17.181 1.5 24 1.5c1.985 0 3.787.03 5.415.081a1.5 1.5 0 0 1 .399.067c1.146.357 4.227 1.633 8.538 5.837c4.062 3.961 5.464 6.864 5.923 8.135q.078.22.088.453c.084 2.261.137 4.89.137 7.927c0 8.11-.377 13.307-.726 16.384c-.33 2.899-2.532 5.088-5.42 5.425c-2.88.336-7.536.691-14.354.691s-11.475-.355-14.354-.691c-2.888-.337-5.09-2.526-5.42-5.425C3.876 37.307 3.5 32.11 3.5 24s.377-13.307.726-16.384c.33-2.899 2.532-5.088 5.42-5.425M13 39.75a1.75 1.75 0 1 1 0-3.5h22a1.75 1.75 0 1 1 0 3.5zM11.25 31c0-.966.784-1.75 1.75-1.75h22a1.75 1.75 0 1 1 0 3.5H13A1.75 1.75 0 0 1 11.25 31m16.197-19.796a26.6 26.6 0 0 1 5.718-.44a2.14 2.14 0 0 1 2.072 2.071a26.7 26.7 0 0 1-.441 5.718c-.346 1.826-2.526 2.303-3.717 1.113l-1.139-1.14l-.236.207a36 36 0 0 0-1.099 1.008c-.898.86-2.027 2.023-3.002 3.28c-.734.946-1.868 1.222-2.792 1.08c-.931-.145-1.963-.77-2.33-1.974c-.366-1.194-.83-2.577-1.316-3.704c-1.054.795-2.719 2.375-4.7 5.403a1.75 1.75 0 0 1-2.93-1.916c2.689-4.108 5.01-6.032 6.445-6.914c1.509-.926 3.3-.246 4.006 1.186c.568 1.152 1.093 2.596 1.511 3.877a37 37 0 0 1 2.69-2.847c.486-.466.906-.844 1.205-1.107l.067-.06l-1.124-1.124c-1.191-1.19-.714-3.37 1.112-3.717"
      clipRule="evenodd"
    />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={className}>
    <path
      fill="currentColor"
      d="M96 96c-35.3 0-64 28.7-64 64v320c0 35.3 28.7 64 64 64h448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64zm224 72c30.9 0 56 25.1 56 56s-25.1 56-56 56s-56-25.1-56-56s25.1-56 56-56m0 152c53 0 96 43 96 96v24c0 13.3-10.7 24-24 24H248c-13.3 0-24-10.7-24-24v-24c0-53 43-96 96-96m96-64c0-26.5 21.5-48 48-48s48 21.5 48 48s-21.5 48-48 48s-48-21.5-48-48m-216 80.3c-15.2 22.8-24 50.2-24 79.7v24c0 8.4 1.4 16.5 4.1 24h-46.8c-11.7 0-21.3-9.6-21.3-21.3V432c0-50.3 38.7-91.6 88-95.7M459.9 464c2.7-7.5 4.1-15.6 4.1-24v-24c0-29.5-8.8-56.9-24-79.7c49.3 4.1 88 45.3 88 95.7v10.7c0 11.8-9.6 21.3-21.3 21.3zM128 256c0-26.5 21.5-48 48-48s48 21.5 48 48s-21.5 48-48 48s-48-21.5-48-48"
    />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <path
      fill="currentColor"
      d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2m7-7H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-1.75 9c0 .23-.02.46-.05.68l1.48 1.16c.13.11.17.3.08.45l-1.4 2.42c-.09.15-.27.21-.43.15l-1.74-.7c-.36.28-.76.51-1.18.69l-.26 1.85c-.03.17-.18.3-.35.3h-2.8c-.17 0-.32-.13-.35-.29l-.26-1.85c-.43-.18-.82-.41-1.18-.69l-1.74.7c-.16.06-.34 0-.43-.15l-1.4-2.42a.35.35 0 0 1 .08-.45l1.48-1.16c-.03-.23-.05-.46-.05-.69s.02-.46.05-.68l-1.48-1.16a.35.35 0 0 1-.08-.45l1.4-2.42c.09-.15.27-.21.43-.15l1.74.7c.36-.28.76-.51 1.18-.69l.26-1.85c.03-.17.18-.3.35-.3h2.8c.17 0 .32.13.35.29l.26 1.85c.43.18.82.41 1.18.69l1.74-.7c.16-.06.34 0 .43.15l1.4 2.42c.09.15.05.34-.08.45l-1.48 1.16c.03.23.05.46.05.69"
    />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" className={className}>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M0 1.5A1.5 1.5 0 0 1 1.5 0h7A1.5 1.5 0 0 1 10 1.5v1.939a2 2 0 0 0-.734 1.311H5.75a2.25 2.25 0 1 0 0 4.5h3.516A2 2 0 0 0 10 10.561V12.5A1.5 1.5 0 0 1 8.5 14h-7A1.5 1.5 0 0 1 0 12.5zm10.963 2.807A.75.75 0 0 0 10.5 5v1H5.75a1 1 0 0 0 0 2h4.75v1a.75.75 0 0 0 1.28.53l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-.817-.163"
      clipRule="evenodd"
    />
  </svg>
);

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId?: string;
};

const pmsNavigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: DashboardIcon, tourId: "nav-dashboard" },
  { name: "Guests & stays", href: "/guests", icon: GuestsIcon, tourId: "nav-guests" },
  { name: "Rooms", href: "/rooms", icon: RoomsIcon, tourId: "nav-rooms" },
  { name: "Billing", href: "/billing", icon: BillingIcon, tourId: "nav-billing" },
  { name: "Reports", href: "/reports", icon: ReportsIcon, tourId: "nav-reports" },
];

const posNavigation: NavItem[] = [
  { name: "Register", href: "/pos", icon: ShoppingCart, tourId: "nav-pos-register" },
  { name: "Orders", href: "/pos/orders", icon: ClipboardList, tourId: "nav-pos-orders" },
  { name: "Products", href: "/pos/products", icon: Package, tourId: "nav-pos-products" },
  { name: "Categories", href: "/pos/categories", icon: Tags, tourId: "nav-pos-categories" },
  { name: "Sales", href: "/pos/sales", icon: Receipt, tourId: "nav-pos-sales" },
  { name: "Floor plan", href: "/pos/tables", icon: LayoutGrid, tourId: "nav-pos-tables" },
];

type SidebarPanelProps = {
  isPos: boolean;
  pathname: string;
  navigation: NavItem[];
  switchHref: string;
  switchTarget: string;
  switchLabel: string;
  modeSwitch: "POS" | "PMS" | null;
  onModeSwitch: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  user: { fullName?: string; username?: string; role?: string } | null;
  onLogout: () => void;
  onNavigate?: () => void;
  showTooltips?: boolean;
  showModeSwitch?: boolean;
};

function SidebarPanel({
  isPos,
  pathname,
  navigation,
  switchHref,
  switchTarget,
  switchLabel,
  modeSwitch,
  onModeSwitch,
  isDarkMode,
  onToggleTheme,
  user,
  onLogout,
  onNavigate,
  showTooltips = true,
  showModeSwitch = true,
}: SidebarPanelProps) {
  const modeSwitchButton = (
    <Link
      href={switchHref}
      data-tour="nav-pos"
      onClick={(e) => {
        onModeSwitch(e);
        onNavigate?.();
      }}
      aria-label={switchLabel}
      aria-disabled={!!modeSwitch}
      className="inline-flex h-9 min-w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/45 px-1.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      <span className="text-[9px] font-semibold uppercase leading-none tracking-wide">
        {switchTarget}
      </span>
    </Link>
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground",
        isPos && "sidebar-pos",
      )}
    >
      <div className="flex items-center gap-3 border-b border-sidebar-border/80 p-4 pr-12 lg:pr-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
          <img src="/logo.png" alt="PalawanSU Hotel Logo" className="h-full w-full object-contain" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold leading-tight tracking-tight text-sidebar-foreground">
            PalawanSU Hotel
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/65">
            {isPos ? "Point of Sale" : "Property Management"}
          </span>
        </div>
        {showModeSwitch &&
          (showTooltips ? (
            <Tooltip>
              <TooltipTrigger asChild>{modeSwitchButton}</TooltipTrigger>
              <TooltipContent side="right">{switchLabel}</TooltipContent>
            </Tooltip>
          ) : (
            modeSwitchButton
          ))}
      </div>

      <div className="mt-1 flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-3">
        {navigation.map((item) => {
          const locPath = pathname.split("?")[0] ?? pathname;
          const isGuestsHub = item.href === "/guests";
          const isPosRegister = item.href === "/pos";
          const isActive = isGuestsHub
            ? locPath === "/guests" || locPath === "/checkin" || locPath === "/reservations"
            : isPosRegister
              ? locPath === "/pos"
              : locPath === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              data-tour={item.tourId}
              onClick={() => onNavigate?.()}
            >
              <div
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_12px_rgba(255,68,0,0.25)]"
                    : "border-transparent text-sidebar-foreground/78 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isPos && isActive && "shadow-[0_0_12px_rgba(13,148,136,0.35)]",
                )}
              >
                <item.icon
                  className={cn(
                    "h-[24px] w-[24px] shrink-0",
                    isActive
                      ? "text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                  )}
                />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/45 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-sidebar-accent"
        >
          <span className="text-sidebar-foreground/80">
            {isDarkMode ? "Dark Mode" : "Light Mode"}
          </span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sidebar text-sidebar-foreground">
            {isDarkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </span>
        </button>

        <div className="mb-2 flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/55 px-3 py-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
              isPos ? "bg-teal-500/20 text-teal-300" : "bg-primary/20 text-primary",
            )}
          >
            {user?.fullName?.charAt(0) || user?.username?.charAt(0) || "U"}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.fullName || user?.username || "User"}
            </span>
            <span className="text-[11px] capitalize text-sidebar-foreground/60">
              {user?.role || "Guest"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogoutIcon className="h-[24px] w-[24px] opacity-70" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [modeSwitch, setModeSwitch] = useState<"POS" | "PMS" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const switchStartedAt = useRef(0);
  const isPos = pathname === "/pos" || pathname.startsWith("/pos/");

  useEffect(() => {
    const savedTheme = localStorage.getItem("palawansu_theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : systemPrefersDark;
    document.documentElement.classList.toggle("dark", shouldUseDark);
    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!modeSwitch) return;
    const arrived = modeSwitch === "POS" ? isPos : !isPos;
    if (!arrived) return;

    const elapsed = Date.now() - switchStartedAt.current;
    const remaining = Math.max(0, 700 - elapsed);
    const timer = window.setTimeout(() => setModeSwitch(null), remaining);
    return () => window.clearTimeout(timer);
  }, [pathname, isPos, modeSwitch]);

  const toggleTheme = () => {
    const nextThemeIsDark = !isDarkMode;
    setIsDarkMode(nextThemeIsDark);
    document.documentElement.classList.toggle("dark", nextThemeIsDark);
    localStorage.setItem("palawansu_theme", nextThemeIsDark ? "dark" : "light");
  };

  const navigation: NavItem[] = isPos
    ? posNavigation
    : [
        ...pmsNavigation,
        ...(user?.role === "admin"
          ? [
              {
                name: "Admin",
                href: "/admin",
                icon: Shield,
                tourId: "nav-admin",
              },
              {
                name: "Users",
                href: "/staff",
                icon: UsersIcon,
                tourId: "nav-users",
              },
              {
                name: "Settings",
                href: "/settings",
                icon: SettingsIcon,
                tourId: "nav-settings",
              },
            ]
          : []),
      ];

  const switchHref = isPos ? "/dashboard" : "/pos";
  const switchTarget = isPos ? "PMS" : "POS";
  const switchLabel = `Switch to ${switchTarget}`;

  const handleModeSwitch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (modeSwitch) return;
    switchStartedAt.current = Date.now();
    setModeSwitch(switchTarget);
    setMobileOpen(false);
    router.push(switchHref);
  };

  const panelProps: SidebarPanelProps = {
    isPos,
    pathname,
    navigation,
    switchHref,
    switchTarget,
    switchLabel,
    modeSwitch,
    onModeSwitch: handleModeSwitch,
    isDarkMode,
    onToggleTheme: toggleTheme,
    user,
    onLogout: () => logout(),
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <AnimatePresence>
        {modeSwitch && (
          <motion.div
            key="mode-switch-overlay"
            className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            aria-live="polite"
            aria-busy="true"
          >
            <motion.div
              className="absolute inset-0 backdrop-blur-[2px]"
              style={{
                background:
                  modeSwitch === "POS"
                    ? "radial-gradient(ellipse at center, rgba(13,148,136,0.28), rgba(2,10,12,0.72) 62%)"
                    : "radial-gradient(ellipse at center, rgba(255,68,0,0.28), rgba(8,10,18,0.72) 62%)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative flex flex-col items-center gap-4"
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <div className="relative flex h-16 w-16 items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      modeSwitch === "POS"
                        ? "conic-gradient(from 0deg, transparent, #14b8a6, #2dd4bf, transparent)"
                        : "conic-gradient(from 0deg, transparent, #ff4400, #ff7a45, transparent)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
                />
                <span className="absolute inset-[3px] rounded-full bg-background/90" />
                <motion.span
                  className="relative text-sm font-bold tracking-[0.18em]"
                  animate={{
                    color:
                      modeSwitch === "POS"
                        ? ["#5eead4", "#14b8a6", "#99f6e4", "#5eead4"]
                        : ["#ff7a45", "#ff4400", "#ffb199", "#ff7a45"],
                  }}
                  transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
                >
                  {modeSwitch}
                </motion.span>
              </div>
              <motion.p
                className="text-xs font-medium uppercase tracking-[0.22em] text-foreground/80"
                animate={{
                  color:
                    modeSwitch === "POS"
                      ? ["#99f6e4", "#5eead4", "#99f6e4"]
                      : ["#ffb199", "#ff7a45", "#ffb199"],
                }}
                transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
              >
                Switching to {modeSwitch}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile / tablet top bar */}
      <header
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border/70 px-3 py-2.5 lg:hidden",
          isPos ? "bg-teal-950/40" : "bg-card/80",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
            <img src="/logo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">PalawanSU Hotel</div>
            <div className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {isPos ? "Point of Sale" : "Property Management"}
            </div>
          </div>
        </div>
        <Link
          href={switchHref}
          data-tour="nav-pos"
          onClick={handleModeSwitch}
          aria-label={switchLabel}
          className="inline-flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 rounded-xl border border-border/80 bg-background px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm hover:text-foreground"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {switchTarget}
        </Link>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-0 sm:p-2 lg:p-3 lg:pt-2">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border border-sidebar-border shadow-[0_20px_80px_rgba(0,0,0,0.22)] lg:flex",
            isPos && "sidebar-pos",
          )}
        >
          <SidebarPanel {...panelProps} showTooltips />
        </aside>

        {/* Mobile / tablet drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className={cn(
              "w-[min(95vw,300px)] overflow-hidden rounded-xl border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent",
              isPos && "sidebar-pos",
            )}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Main app navigation</SheetDescription>
            </SheetHeader>
            <SidebarPanel
              {...panelProps}
              showTooltips={false}
              showModeSwitch={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-background sm:rounded-2xl sm:border sm:border-border/70 lg:ml-3">
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-6 md:p-5 md:pb-8 lg:p-6 lg:pb-8">
            <div className="mx-auto min-h-full w-full min-w-0 max-w-7xl xl:mx-0 xl:max-w-none">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
