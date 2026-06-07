import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as api from "./api";
import type { Me } from "./api";

// JWT lives in the iOS keychain via expo-secure-store, not plain storage.
const TOKEN_KEY = "ldr_token";

async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Keychain unavailable (rare) — auth still works for this session.
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
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback(async (value: string | null) => {
    await writeToken(value);
    setToken(value);
  }, []);

  const loadMe = useCallback(async (value: string) => {
    const profile = await api.getMe(value);
    setMe(profile);
  }, []);

  // On mount, restore any stored token and fetch the profile.
  useEffect(() => {
    let active = true;
    readToken().then(async (stored) => {
      if (!active) return;
      if (!stored) {
        setLoading(false);
        return;
      }
      setToken(stored);
      try {
        await loadMe(stored);
      } catch {
        // Token is stale/invalid — clear it.
        await writeToken(null);
        if (active) {
          setToken(null);
          setMe(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const value = await api.login(email, password);
      await applyToken(value);
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
    void applyToken(null);
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
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
