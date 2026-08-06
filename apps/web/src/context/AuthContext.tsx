import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api, ApiError, resetCsrfToken } from '../api/client';

interface CurrentUser {
  id: string;
  username: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CurrentUser>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const loggedIn = await api.post<CurrentUser>('/auth/login', { username, password });
      setUser(loggedIn);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    resetCsrfToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
