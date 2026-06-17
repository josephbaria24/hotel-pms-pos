import { Switch, Route, Router as WouterRouter, useLocation, useSearch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { applyUiScale, getStoredUiScale } from "@/lib/ui-scale";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Rooms from "@/pages/rooms";
import Guests from "@/pages/guests";
import Billing from "@/pages/billing";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

/** Legacy URLs `/reservations` and `/checkin` → integrated Guests hub. */
function RedirectToGuestHub({ tab }: { tab: "bookings" | "stays" }) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  useEffect(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const p = new URLSearchParams(raw);
    p.set("tab", tab);
    setLocation(`/guests?${p.toString()}`);
  }, [search, setLocation, tab]);
  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
      Opening Guests &amp; stays…
    </div>
  );
}

function RedirectReservationsToGuests() {
  return <RedirectToGuestHub tab="bookings" />;
}

function RedirectCheckinToGuests() {
  return <RedirectToGuestHub tab="stays" />;
}

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <SidebarLayout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/reservations" component={RedirectReservationsToGuests} />
            <Route path="/rooms" component={Rooms} />
            <Route path="/guests" component={Guests} />
            <Route path="/checkin" component={RedirectCheckinToGuests} />
            <Route path="/billing" component={Billing} />
            <Route path="/reports" component={Reports} />
            <Route path="/users" component={Users} />
            <Route path="/settings" component={Settings} />
            <Route path="/" component={Dashboard} />
            <Route component={NotFound} />
          </Switch>
        </SidebarLayout>
      </Route>
    </Switch>
  );
}

function App() {
  const isElectron = window.__ELECTRON__?.isElectron;
  console.info(`[App] Mounting. isElectron: ${isElectron}, base: ${isElectron ? "" : import.meta.env.BASE_URL}`);

  useEffect(() => {
    applyUiScale(getStoredUiScale(), false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <WouterRouter 
          hook={isElectron ? useHashLocation : undefined}
          base={isElectron ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}
        >
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
