import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type UserRole = "admin" | "coordinator" | "doctor" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  nameAr: string;
  nameEn: string | null;
  consentGivenAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  giveConsent: () => Promise<void>;
  canWrite: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "hrp_access_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: localStorage.getItem(TOKEN_KEY),
    loading: true,
  });

  // Wire the global API client to always inject the current bearer token
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      const data = await res.json() as { accessToken: string };
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      setState(s => ({ ...s, accessToken: data.accessToken }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<AuthUser>;
    } catch {
      return null;
    }
  }, []);

  // On mount: try to restore session
  useEffect(() => {
    (async () => {
      let token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          setState({ user: null, accessToken: null, loading: false });
          return;
        }
        token = localStorage.getItem(TOKEN_KEY);
      }

      if (!token) {
        setState({ user: null, accessToken: null, loading: false });
        return;
      }

      const user = await fetchMe(token);
      if (user) {
        setState({ user, accessToken: token, loading: false });
      } else {
        // Token expired, try refresh
        const refreshed = await refreshToken();
        if (refreshed) {
          const newToken = localStorage.getItem(TOKEN_KEY)!;
          const freshUser = await fetchMe(newToken);
          setState({ user: freshUser, accessToken: newToken, loading: false });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setState({ user: null, accessToken: null, loading: false });
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? "فشل تسجيل الدخول");
    }

    const data = await res.json() as { accessToken: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setState({ user: data.user, accessToken: data.accessToken, loading: false });
  }, []);

  const logout = useCallback(async () => {
    // Always call logout endpoint — it clears the httpOnly refresh cookie server-side.
    // Does not require a valid access token (endpoint accepts expired/missing tokens).
    const token = localStorage.getItem(TOKEN_KEY);
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, accessToken: null, loading: false });
  }, []);

  const giveConsent = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    await fetch(`${API}/auth/consent`, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    setState(s => s.user ? { ...s, user: { ...s.user, consentGivenAt: new Date().toISOString() } } : s);
  }, []);

  const canWrite = state.user !== null && state.user.role !== "viewer";
  const isAdmin = state.user?.role === "admin";

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshToken, giveConsent, canWrite, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
