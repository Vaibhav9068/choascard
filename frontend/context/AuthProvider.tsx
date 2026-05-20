"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, restoreSession, type UserProfile } from "@/lib/api";
import {
  applyAuthSession,
  clearAuth,
  getAuthUser,
  subscribeAuth,
  setAuthUser,
  type AuthTokensResponse,
} from "@/lib/authStore";
import {
  connectSocket,
  disconnectSocket,
  reconnectSocketWithFreshToken,
} from "@/lib/socket";

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ status: number; error?: string }>;
  register: (data: Record<string, string>) => Promise<{ error?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ error?: string }>;
  resendOtp: (email: string) => Promise<{ error?: string; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login", "/register", "/verify-otp"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(getAuthUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAuth(() => setUser(getAuthUser()));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // If we already finished the initial load, do not run restoreSession again
    if (typeof window !== "undefined" && (window as any).__initialAuthChecked) {
      return;
    }

    let mounted = true;

    // Check if we are on a public path and have no session flag
    const isPublic = PUBLIC_PATHS.includes(pathname);
    const hasSessionFlag = typeof window !== "undefined" && localStorage.getItem("chaosdeck_logged_in") === "true";

    if (isPublic && !hasSessionFlag) {
      if (typeof window !== "undefined") {
        (window as any).__initialAuthChecked = true;
      }
      setIsLoading(false);
      return;
    }

    // Set a timer to detect slow backend response/cold starts (Render free tier)
    const slowTimer = setTimeout(() => {
      if (mounted) {
        setIsSlowLoading(true);
      }
    }, 3500);

    (async () => {
      const restored = await restoreSession();
      if (!mounted) return;

      clearTimeout(slowTimer);
      if (typeof window !== "undefined") {
        (window as any).__initialAuthChecked = true;
      }

      if (restored) {
        connectSocket();
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem("chaosdeck_logged_in");
        }
      }
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
      clearTimeout(slowTimer);
    };
  }, [pathname]);

  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!user && !isPublic) {
      router.replace("/login");
    } else if (user && isPublic) {
      router.replace("/");
    }
  }, [isLoading, user, pathname, router]);

  const handleAuthSuccess = useCallback(
    (payload: AuthTokensResponse) => {
      applyAuthSession(payload);
      reconnectSocketWithFreshToken();
      router.replace("/");
    },
    [router]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<AuthTokensResponse>("/api/auth/login", {
        data: { email, password },
        skipAuthRefresh: true,
      });

      if (res.status === 403) {
        return { status: 403 };
      }

      if (res.error || !res.data?.accessToken) {
        return { status: res.status, error: res.error };
      }

      handleAuthSuccess(res.data);
      return { status: 200 };
    },
    [handleAuthSuccess]
  );

  const register = useCallback(async (data: Record<string, string>) => {
    const res = await apiFetch<{ message: string }>("/api/auth/register", {
      data,
      skipAuthRefresh: true,
    });
    return { error: res.error };
  }, []);

  const verifyOtp = useCallback(
    async (email: string, otp: string) => {
      const res = await apiFetch<AuthTokensResponse>("/api/auth/verify-otp", {
        data: { email, otp },
        skipAuthRefresh: true,
      });

      if (res.error || !res.data?.accessToken) {
        return { error: res.error };
      }

      handleAuthSuccess(res.data);
      return {};
    },
    [handleAuthSuccess]
  );

  const resendOtp = useCallback(async (email: string) => {
    const res = await apiFetch<{ message: string }>("/api/auth/resend-otp", {
      data: { email },
      skipAuthRefresh: true,
    });
    return { error: res.error, message: res.data?.message || res.message };
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    clearAuth();
    disconnectSocket();
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const res = await apiFetch<UserProfile>("/api/auth/me");
    if (res.data) {
      setAuthUser(res.data);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      verifyOtp,
      resendOtp,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, verifyOtp, resendOtp, logout, refreshUser]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-game-bg text-white p-4">
        {/* Esports Style Header */}
        <div className="text-center mb-8 animate-pulse">
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_4px_12px_rgba(250,229,0,0.2)]">
            CHAOS DECK
          </h1>
          <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest">Loading Arena...</p>
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center mb-6">
          <div className="absolute inset-0 border-4 border-accent/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>

        {isSlowLoading && (
          <div className="text-center max-w-xs animate-fade-in">
            <p className="text-accent text-sm font-semibold mb-1">
              Waking up game server...
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Render's free tier server spins down after inactivity. This can take up to 60 seconds. Thank you for your patience!
            </p>
          </div>
        )}
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
