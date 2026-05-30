import type { RefreshResponse } from '../types';

/** Almacén de tokens inyectado por cada plataforma (móvil: expo-secure-store). */
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: { accessToken: string; refreshToken?: string | null }): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientConfig {
  baseUrl: string;
  tokens: TokenStore;
  /** Se invoca cuando el refresh falla definitivamente (forzar re-login). */
  onAuthError?: () => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Si es true no se intenta adjuntar/renovar el token (p. ej. login). */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, tokens, onAuthError } = config;
  // Garantiza un único refresh en vuelo aunque varias peticiones reciban 401 a la vez.
  let refreshing: Promise<string | null> | null = null;

  async function doRefresh(): Promise<string | null> {
    const refreshToken = await tokens.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      if (!data.token) return null;
      await tokens.setTokens({ accessToken: data.token, refreshToken: data.refresh_token ?? refreshToken });
      return data.token;
    } catch {
      return null;
    }
  }

  async function refreshOnce(): Promise<string | null> {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, skipAuth = false, signal } = options;

    const buildHeaders = async (): Promise<Record<string, string>> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!skipAuth) {
        const token = await tokens.getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      return headers;
    };

    const send = async (headers: Record<string, string>) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

    let res = await send(await buildHeaders());

    // Renovación transparente ante 401/403 por token vencido.
    if ((res.status === 401 || res.status === 403) && !skipAuth) {
      const newToken = await refreshOnce();
      if (newToken) {
        res = await send({ 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` });
      } else {
        await tokens.clear();
        onAuthError?.();
      }
    }

    const text = await res.text();
    const payload = text ? safeJson(text) : null;

    if (!res.ok) {
      const message = extractError(payload) ?? `Error ${res.status}`;
      throw new ApiError(res.status, message, payload);
    }
    return payload as T;
  }

  return { request, refreshOnce };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractError(payload: unknown): string | null {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
  }
  return null;
}
