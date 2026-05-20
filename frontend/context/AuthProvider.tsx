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

  useEffect(() => {
    const unsubscribe = subscribeAuth(() => setUser(getAuthUser()));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const restored = await restoreSession();
      if (!mounted) return;

      if (restored) {
        connectSocket();
      }
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
      <div className="min-h-screen w-full flex items-center justify-center bg-game-bg">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
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
