import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = "palawansu_user";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutMutation = useLogout();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUserState(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const setUser = (user: User | null) => {
    setUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      // Use the 'location' from wouter which is protocol-aware (works with Hash routing)
      const path = window.location.hash 
        ? window.location.hash.slice(1) || "/" 
        : window.location.pathname;

      console.info(`[Auth] Heartbeat: user=${user ? user.username : "null"}, path=${path}`);

      if (!user && path !== "/login") {
        console.info(`[Auth] Redirecting to /login from ${path}`);
        setLocation("/login");
      } else if (user && path === "/login") {
        console.info(`[Auth] User exists, redirecting to /dashboard`);
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, setLocation]);

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
    }
    setUser(null);
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
