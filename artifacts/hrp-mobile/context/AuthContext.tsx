import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

const TOKEN_KEY = "hrp_access_token";
const USER_KEY = "hrp_user";

export const BANNER_KEY_PREFIX = "hrp_urgent_banner_dismissed_count_";

export interface UserProfile {
  id: number;
  username: string;
  role: "admin" | "coordinator" | "doctor" | "viewer";
  nameAr: string;
  nameEn?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let _moduleToken: string | null = null;

export function getModuleToken(): string | null {
  return _moduleToken;
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

async function cleanUpStaleBannerKeys(currentUserId: number): Promise<void> {
  try {
    const currentKey = `${BANNER_KEY_PREFIX}${currentUserId}`;
    if (Platform.OS === "web") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(BANNER_KEY_PREFIX) && key !== currentKey) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } else {
      const allKeys = await AsyncStorage.getAllKeys();
      const staleKeys = allKeys.filter(
        (k) => k.startsWith(BANNER_KEY_PREFIX) && k !== currentKey
      );
      if (staleKeys.length > 0) {
        await AsyncStorage.multiRemove(staleKeys);
      }
    }
  } catch {
    // ignore — cleanup is best-effort
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await secureGet(TOKEN_KEY);
        const storedUser = await secureGet(USER_KEY);
        if (storedToken && storedUser) {
          _moduleToken = storedToken;
          const parsedUser = JSON.parse(storedUser) as UserProfile;
          await cleanUpStaleBannerKeys(parsedUser.id);
          setToken(storedToken);
          setUser(parsedUser);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (newToken: string, newUser: UserProfile) => {
    _moduleToken = newToken;
    await secureSet(TOKEN_KEY, newToken);
    await secureSet(USER_KEY, JSON.stringify(newUser));
    await cleanUpStaleBannerKeys(newUser.id);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    const userId = _moduleToken !== null ? user?.id : undefined;
    _moduleToken = null;
    await secureDelete(TOKEN_KEY);
    await secureDelete(USER_KEY);
    if (userId !== undefined) {
      try {
        const bannerKey = `${BANNER_KEY_PREFIX}${userId}`;
        if (Platform.OS === "web") {
          localStorage.removeItem(bannerKey);
        } else {
          await AsyncStorage.removeItem(bannerKey);
        }
      } catch {
        // ignore
      }
    }
    setToken(null);
    setUser(null);
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
