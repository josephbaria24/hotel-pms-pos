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
import {
  SESSION_NONCE_STORAGE_KEY,
  SESSION_REPLACED_MESSAGE,
} from "@/lib/auth-session";

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

function storedSessionNonce() {
  try {
    return localStorage.getItem(SESSION_NONCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearStoredSessionNonce() {
  try {
    localStorage.removeItem(SESSION_NONCE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

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

function sessionWasReplaced(profile: { session_nonce?: string | null } | null) {
  const expected = profile?.session_nonce;
  if (!expected) return false;
  return storedSessionNonce() !== expected;
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
    clearStoredSessionNonce();
    setTimeout(() => {
      void createClient().auth.signOut();
    }, 0);
    return null;
  }

  if (sessionWasReplaced(profile)) {
    stashLoginError(SESSION_REPLACED_MESSAGE);
    clearStoredSessionNonce();
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
    const supabase = createClient();
    let sessionChannel: ReturnType<typeof supabase.channel> | null = null;

    const stopWatching = () => {
      if (sessionChannel) {
        void supabase.removeChannel(sessionChannel);
        sessionChannel = null;
      }
    };

    const kickIfNonceMismatch = (remoteNonce: string | null | undefined) => {
      if (!remoteNonce || storedSessionNonce() === remoteNonce) return false;
      stashLoginError(SESSION_REPLACED_MESSAGE);
      clearStoredSessionNonce();
      setUserState(null);
      redirectToLoginIfNeeded(router);
      setTimeout(() => {
        void createClient().auth.signOut();
      }, 0);
      return true;
    };

    const watchSession = (userId: string) => {
      stopWatching();
      sessionChannel = supabase
        .channel(`profile-session:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const nonce = (payload.new as { session_nonce?: string | null })
              .session_nonce;
            kickIfNonceMismatch(nonce);
          },
        )
        .subscribe();
    };

    const verifyRemoteSession = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("session_nonce, is_active")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile?.is_active === false) {
        stashLoginError(ACCOUNT_INACTIVE_MESSAGE);
        clearStoredSessionNonce();
        setUserState(null);
        redirectToLoginIfNeeded(router);
        setTimeout(() => {
          void createClient().auth.signOut();
        }, 0);
        return;
      }
      if (!kickIfNonceMismatch(profile?.session_nonce)) {
        watchSession(authUser.id);
      }
    };

    (async () => {
      try {
        const profile = await loadProfile();
        if (!mounted) return;
        setUserState(profile);
        if (!profile) redirectToLoginIfNeeded(router);
        else {
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          if (authUser) watchSession(authUser.id);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void (async () => {
          if (!mounted) return;

          if (event === "SIGNED_OUT" || !session?.user) {
            stopWatching();
            setUserState(null);
            return;
          }

          const profile = await loadProfileForUser(session.user);
          if (!mounted) return;
          setUserState(profile);
          if (!profile) {
            stopWatching();
            redirectToLoginIfNeeded(router);
            return;
          }
          watchSession(session.user.id);
        })();
      }, 0);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void verifyRemoteSession();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(() => {
      void verifyRemoteSession();
    }, 20_000);

    return () => {
      mounted = false;
      stopWatching();
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
    };
  }, [router]);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
  }, []);

  const logout = useCallback(() => {
    clearStoredSessionNonce();
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
