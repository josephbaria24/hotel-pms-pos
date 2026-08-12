"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  setUser: () => {},
  logout: () => {},
  refresh: async () => {},
});

async function loadProfile(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  return {
    id: authUser.id,
    username:
      profile?.username ??
      authUser.email?.split("@")[0] ??
      "user",
    fullName:
      profile?.full_name ??
      (authUser.user_metadata?.full_name as string | undefined) ??
      authUser.email ??
      "User",
    role: (profile?.role as string) ?? "staff",
    isActive: profile?.is_active ?? true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const profile = await loadProfile();
    setUserState(profile);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await loadProfile();
        if (mounted) setUserState(profile);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const profile = await loadProfile();
      if (mounted) setUserState(profile);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserState(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, setUser, logout, refresh }),
    [user, isLoading, setUser, logout, refresh],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
