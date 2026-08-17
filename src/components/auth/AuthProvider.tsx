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
import type { User as AuthUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/api-client";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  stashLoginError,
} from "@/lib/auth-messages";

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

function mapAuthUser(
  authUser: AuthUser,
  profile: {
    username?: string | null;
    full_name?: string | null;
    role?: string | null;
    is_active?: boolean | null;
    onboarding_completed?: boolean | null;
  } | null,
): User {
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
    email: authUser.email ?? null,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
  };
}

/** Load profile for a known auth user. Does not call auth.getUser/getSession. */
async function loadProfileForUser(authUser: AuthUser): Promise<User | null> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profile && profile.is_active === false) {
    stashLoginError(ACCOUNT_INACTIVE_MESSAGE);
    // Defer signOut so we never call it under an auth-state lock.
    setTimeout(() => {
      void createClient().auth.signOut();
    }, 0);
    return null;
  }

  return mapAuthUser(authUser, profile);
}

async function loadProfile(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  return loadProfileForUser(authUser);
}

function redirectToLoginIfNeeded(router: ReturnType<typeof useRouter>) {
  const path = window.location.pathname;
  if (path !== "/login" && !path.startsWith("/login")) {
    router.replace("/login");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const profile = await loadProfile();
    setUserState(profile);
    if (!profile) redirectToLoginIfNeeded(router);
  }, [router]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const profile = await loadProfile();
        if (!mounted) return;
        setUserState(profile);
        if (!profile) redirectToLoginIfNeeded(router);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // CRITICAL: never await supabase.auth.* directly inside this callback.
      // Doing so deadlocks signOut()/signIn() and causes infinite loading.
      setTimeout(() => {
        void (async () => {
          if (!mounted) return;

          if (event === "SIGNED_OUT" || !session?.user) {
            setUserState(null);
            return;
          }

          const profile = await loadProfileForUser(session.user);
          if (!mounted) return;
          setUserState(profile);
          if (!profile) redirectToLoginIfNeeded(router);
        })();
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    router.replace("/login");
    const supabase = createClient();
    void supabase.auth.signOut().catch(() => {
      // Session may already be cleared; ignore.
    });
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
