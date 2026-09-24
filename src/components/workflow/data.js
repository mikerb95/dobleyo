// Acceso a datos del flujo guiado de producción.
//
// Los GET nuevos (/coffee/workflow/*) usan el sobre { success, data } y pasan
// por useApi. Los POST de cada paso son los endpoints de siempre, que
// responden { success, ...datos } sin `data`: por eso tienen su propio helper.

import { useEffect, useState } from "react";
import { useApi } from "../../lib/api.js";

export class StepError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "StepError";
    this.detail = detail ?? null;
  }
}

/** Registra un paso en /api/coffee/* (o /api/labels/*) y devuelve la respuesta completa. */
export async function postStep(path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StepError("No hay conexión con el servidor. Revise su internet e intente de nuevo.");
  }

  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }

  if (res.status === 401) {
    throw new StepError("Su sesión expiró. Recargue la página e ingrese de nuevo; lo digitado se conserva mientras no cierre esta ventana.");
  }
  if (!res.ok || json?.success === false) {
    const validation = json?.errors?.[0]?.msg;
    throw new StepError(
      json?.error || validation || `El servidor no pudo guardar el registro (error ${res.status}).`,
      json?.detail
    );
  }
  return json ?? { success: true };
}

/**
 * Rol y nombre del usuario en sesión. AdminLayout ya consulta /api/auth/me y
 * emite `dy:user`; si el evento pasó antes de montar, se consulta de nuevo.
 */
export function useRole() {
  const [user, setUser] = useState(() => {
    const role = typeof window !== "undefined" ? window.__userRole ?? null : null;
    return { role, firstName: null };
  });

  useEffect(() => {
    let alive = true;
    const apply = (u) => alive && u?.role && setUser({ role: u.role, firstName: u.first_name ?? null });
    const onUser = (e) => apply(e.detail);
    document.addEventListener("dy:user", onUser);
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(apply)
      .catch(() => {});
    return () => {
      alive = false;
      document.removeEventListener("dy:user", onUser);
    };
  }, []);

  return user;
}

export function useQueue() {
  return useApi("/coffee/workflow/queue");
}

export function useLot(lotId) {
  return useApi(lotId ? `/coffee/workflow/lots/${encodeURIComponent(lotId)}` : null, {
    deps: [lotId],
    enabled: !!lotId,
  });
}

export function useLocations(state) {
  return useApi(`/storage/locations?state=${state}&include_blocked=0`, { deps: [state] });
}

/** Insumos de empaque. Solo admin: al caficultor el endpoint responde 403. */
export function useSupplies(enabled) {
  return useApi(enabled ? "/costs/supplies/list" : null, { deps: [enabled], enabled });
}

// Fincas de respaldo: las mismas del formulario clásico de cosecha. El servidor
// resuelve su región y altura con su propio mapa (FARM_MAP) si no llegan.
const FALLBACK_FARMS = [
  { slug: "finca-la-sierra", name: "La Sierra", municipality: "Huila", region: "HUI", altitude_min: 1800 },
  { slug: "finca-nariño", name: "Nariño Premium", municipality: "Nariño", region: "NAR", altitude_min: 1900 },
  { slug: "finca-cauca", name: "Cauca Estate", municipality: "Cauca", region: "CAU", altitude_min: 1750 },
];

/** Fincas para la cosecha: el admin ve todas, el caficultor las suyas. */
export function useFarms(role) {
  const path = role === "admin" ? "/farms/admin/all" : role ? "/farms/my?list=true" : null;
  const res = useApi(path, { deps: [path], enabled: !!path });
  const list = (res.data ?? []).filter((f) => f.slug);
  return { ...res, data: res.loading ? null : list.length ? list : FALLBACK_FARMS };
}

/** Número en pesos colombianos sin decimales. */
export const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Lee un número escrito con coma o punto decimal. */
export function num(value) {
  if (value === "" || value == null) return NaN;
  return parseFloat(String(value).replace(",", "."));
}

/** Costo del paso listo para el payload, o undefined si no se digitó. */
export function costPayload(cost) {
  const amount = Number(String(cost?.amount ?? "").replace(/[^\d]/g, ""));
  return amount > 0 ? { amount, paymentMethod: cost.method || "caja" } : undefined;
}
