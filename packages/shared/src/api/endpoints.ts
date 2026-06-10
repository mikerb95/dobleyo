import type { ApiClient } from './client';
import type {
  ApiEnvelope,
  AuthUser,
  Cupping,
  CuppingInput,
  GreenStorageInput,
  Harvest,
  HarvestInput,
  InventoryProduct,
  LoginResponse,
  Lot,
  PackagedItem,
  PackagingInput,
  RoastBatch,
  RoastRetrievalInput,
  RoastedStorageInput,
  SendRoastingInput,
  StockItem,
  WithClientOpId,
} from '../types';

/**
 * Construye la API de dominio sobre un ApiClient.
 * Cada grupo refleja un router de server/routes/*.
 */
export function createApi(client: ApiClient) {
  const { request } = client;

  return {
    auth: {
      login: (email: string, password: string) =>
        request<LoginResponse>('/api/auth/login', {
          method: 'POST',
          // `client: 'mobile'` indica al backend que devuelva el refresh_token
          // en JSON (los clientes nativos no pueden usar cookies HttpOnly).
          body: { email, password, client: 'mobile' },
          skipAuth: true,
        }),
      me: () => request<AuthUser>('/api/auth/me'),
      logout: (refresh_token?: string) =>
        request<{ message: string }>('/api/auth/logout', {
          method: 'POST',
          body: { refresh_token },
        }),
    },

    // Línea de producción — /api/coffee/*
    production: {
      getHarvests: () => unwrap(request<ApiEnvelope<Harvest[]>>('/api/coffee/harvests')),
      getGreenInventory: () => unwrap(request<ApiEnvelope<Lot[]>>('/api/coffee/green-inventory')),
      getRoastingBatches: () => unwrap(request<ApiEnvelope<RoastBatch[]>>('/api/coffee/roasting-batches')),
      getRoastedCoffee: () => unwrap(request<ApiEnvelope<RoastBatch[]>>('/api/coffee/roasted-coffee')),
      getRoastedForStorage: () => unwrap(request<ApiEnvelope<RoastBatch[]>>('/api/coffee/roasted-for-storage')),
      getPackaged: () => unwrap(request<ApiEnvelope<PackagedItem[]>>('/api/coffee/packaged')),
      getLots: () => unwrap(request<ApiEnvelope<Lot[]>>('/api/coffee/lots')),
      getLotStage: (lotId: string | number) =>
        unwrap(request<ApiEnvelope<{ stage: string }>>(`/api/coffee/lots/${lotId}/stage`)),

      createHarvest: (input: HarvestInput & WithClientOpId) =>
        request<{ success: boolean; lotId?: string | number }>('/api/coffee/harvest', { method: 'POST', body: input }),
      storeGreen: (input: GreenStorageInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/inventory-storage', { method: 'POST', body: input }),
      sendRoasting: (input: SendRoastingInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/send-roasting', { method: 'POST', body: input }),
      receiveRoasted: (input: RoastRetrievalInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/roast-retrieval', { method: 'POST', body: input }),
      storeRoasted: (input: RoastedStorageInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/roasted-storage', { method: 'POST', body: input }),
      packaging: (input: PackagingInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/packaging', { method: 'POST', body: input }),

      getCuppings: () => unwrap(request<ApiEnvelope<Cupping[]>>('/api/coffee/cupping')),
      getRoastedForCupping: () => unwrap(request<ApiEnvelope<RoastBatch[]>>('/api/coffee/roasted-for-cupping')),
      createCupping: (input: CuppingInput & WithClientOpId) =>
        request<{ success: boolean }>('/api/coffee/cupping', { method: 'POST', body: input }),
    },

    // Inventario — /api/inventory, /api/stock
    inventory: {
      getProducts: () => unwrap(request<ApiEnvelope<InventoryProduct[]>>('/api/inventory')),
      getStock: () => unwrap(request<ApiEnvelope<StockItem[]>>('/api/stock')),
    },

    // Reportes — /api/dashboard/*
    reports: {
      getKpis: () => request<unknown>('/api/dashboard/kpis'),
      getAlerts: () => request<unknown>('/api/dashboard/alerts'),
      getActivity: () => request<unknown>('/api/dashboard/activity'),
    },

    // Trazabilidad — /api/traceability
    // (no usar /api/lots/:id aquí: es del ERP web y exige rol admin)
    traceability: {
      lookup: (code: string) => request<unknown>(`/api/traceability/${encodeURIComponent(code)}`),
    },
  };
}

export type Api = ReturnType<typeof createApi>;

/** Desempaqueta `{ success, data }` devolviendo `data` (o [] si falta). */
async function unwrap<T>(p: Promise<ApiEnvelope<T>>): Promise<T> {
  const env = await p;
  return (env.data ?? ([] as unknown as T)) as T;
}
