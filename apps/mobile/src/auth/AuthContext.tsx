import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@dobleyo/shared';
import { api, onAuthError } from '../lib/api';
import { secureTokenStore } from '../lib/tokenStore';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(async () => {
    await secureTokenStore.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Restaurar sesión al arrancar: si hay token válido, /me devuelve el usuario.
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await secureTokenStore.getAccessToken();
      if (!token) {
        if (active) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await api.auth.me();
        if (active) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (active) await clearSession();
      }
    })();
    return () => {
      active = false;
    };
  }, [clearSession]);

  // El cliente API avisa cuando el refresh falla definitivamente.
  useEffect(() => {
    onAuthError(() => {
      void clearSession();
    });
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    await secureTokenStore.setTokens({
      accessToken: res.token,
      refreshToken: res.refresh_token ?? null,
    });
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refresh = await secureTokenStore.getRefreshToken();
    try {
      await api.auth.logout(refresh ?? undefined);
    } catch {
      // Ignorar errores de red en logout; limpiamos localmente igual.
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
