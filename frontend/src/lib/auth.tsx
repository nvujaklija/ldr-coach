"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearToken,
  getMe,
  getToken,
  loginUser,
  registerUser,
  setToken,
  type User,
} from "@/lib/api";

interface AuthState {
  user: User | null;
  useMemo,
  useState,
} from "react";
import * as api from "@/lib/api";
import type { Me } from "@/lib/api";

const TOKEN_KEY = "ldr_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

interface AuthState {
  token: string | null;
  me: Me | null;
  /** True until the initial token check / profile load settles. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, if a token is stored, resolve the current user. A stale or
  // invalid token (401) is discarded so the guard sends them to /login.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginUser(email, password);
    setToken(token);
    setUser(await getMe());
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await registerUser(email, password, displayName);
      const token = await loginUser(email, password);
      setToken(token);
      setUser(await getMe());
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((value: string | null) => {
    storeToken(value);
    setToken(value);
  }, []);

  const loadMe = useCallback(async (value: string) => {
    const profile = await api.getMe(value);
    setMe(profile);
  }, []);

  // On mount, restore any stored token and fetch the profile.
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    loadMe(stored)
      .catch(() => {
        // Token is stale/invalid — clear it.
        storeToken(null);
        setToken(null);
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const value = await api.login(email, password);
      applyToken(value);
      await loadMe(value);
    },
    [applyToken, loadMe],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await api.register(email, password, displayName);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    applyToken(null);
    setMe(null);
  }, [applyToken]);

  const refresh = useCallback(async () => {
    if (token) await loadMe(token);
  }, [token, loadMe]);

  const value = useMemo<AuthState>(
    () => ({ token, me, loading, login, register, logout, refresh }),
    [token, me, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
