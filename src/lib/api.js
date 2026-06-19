// src/lib/api.js
// Capa compartida de acceso a /api/*
// JWT viaja en cookie HttpOnly → credentials: 'include'.
// Contrato { success: true, data } estricto.

import { useEffect, useRef, useState, useCallback } from "react";

export class ApiError extends Error {
  constructor(status, code, message, payload) {
    super(message || `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code ?? null;
    this.payload = payload;
  }
  get isAuth()    { return this.status === 401 || this.status === 403; }
  get isNetwork() { return this.status === 0; }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", err.message);
  }

  let json = null;
  try { json = await res.json(); } catch { /* no-json */ }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? null,
      json?.error?.message ?? res.statusText,
      json
    );
  }
  if (!json || json.success !== true) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? "bad_envelope",
      json?.error?.message ?? "Respuesta sin envoltorio success",
      json
    );
  }
  return json.data;
}

export const api = {
  get:   (p, o)    => request(p, { ...o, method: "GET" }),
  post:  (p, b, o) => request(p, { ...o, method: "POST",  body: b }),
  put:   (p, b, o) => request(p, { ...o, method: "PUT",   body: b }),
  patch: (p, b, o) => request(p, { ...o, method: "PATCH", body: b }),
  del:   (p, o)    => request(p, { ...o, method: "DELETE" }),
};

export function useApi(path, { deps = [], enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!(enabled && path) });
  const reqIdRef = useRef(0);

  const run = useCallback(() => {
    if (!enabled || !path) {
      setState({ data: null, error: null, loading: false });
      return () => {};
    }
    const ctrl = new AbortController();
    const reqId = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path, { signal: ctrl.signal })
      .then((data) => {
        if (reqId !== reqIdRef.current) return;
        setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (reqId !== reqIdRef.current) return;
        setState({ data: null, error: err, loading: false });
      });
    return () => ctrl.abort();
  }, [path, enabled]);

  useEffect(() => run(), [run, ...deps]);

  return { ...state, refetch: run };
}
