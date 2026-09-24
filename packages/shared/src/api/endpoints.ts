import type { ApiClient } from './client';
import type {
  ApiEnvelope,
  AuthUser,
  CuppingInput,
  FarmOption,
  GenerateLabelsInput,
  GreenStorageInput,
  Harvest,
  HarvestInput,
  InventoryProduct,
  LoginResponse,
  PackagingInput,
  PackagingSupply,
  RoastRetrievalInput,
  RoastedStorageInput,
  SendRoastingInput,
  StepResult,
  StockItem,
  StorageLocation,
  WithClientOpId,
} from '../types';
import type { LotJourney, WorkflowQueue } from '../workflow';

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

    // Línea de producción: /api/coffee/*
    // Los GET de lista devuelven el arreglo sin sobre; los POST devuelven
    // { success, ...datos } sin `data`. Por eso no pasan por unwrap().
    production: {
      getHarvests: () => request<Harvest[]>('/api/coffee/harvests'),
      getLotStage: (lotId: string) =>
        request<{ success: boolean; stage: string; label: string }>(`/api/coffee/lots/${encodeURIComponent(lotId)}/stage`),

      createHarvest: (input: HarvestInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/harvest', { method: 'POST', body: input }),
      storeGreen: (input: GreenStorageInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/inventory-storage', { method: 'POST', body: input }),
      sendRoasting: (input: SendRoastingInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/send-roasting', { method: 'POST', body: input }),
      receiveRoasted: (input: RoastRetrievalInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/roast-retrieval', { method: 'POST', body: input }),
      storeRoasted: (input: RoastedStorageInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/roasted-storage', { method: 'POST', body: input }),
      packaging: (input: PackagingInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/packaging', { method: 'POST', body: input }),
      createCupping: (input: CuppingInput & WithClientOpId) =>
        request<StepResult>('/api/coffee/cupping', { method: 'POST', body: input }),
    },

    // Flujo guiado: bandeja "Qué sigue" y ficha del lote.
    workflow: {
      getQueue: () => unwrap(request<ApiEnvelope<WorkflowQueue>>('/api/coffee/workflow/queue')),
      getLot: (lotId: string) =>
        unwrap(request<ApiEnvelope<LotJourney>>(`/api/coffee/workflow/lots/${encodeURIComponent(lotId)}`)),
    },

    // Datos de apoyo de los formularios.
    catalog: {
      /** Fincas del caficultor en sesión. */
      getMyFarms: () => unwrap(request<ApiEnvelope<FarmOption[]>>('/api/farms/my?list=true')),
      /** Todas las fincas (solo admin). */
      getAllFarms: () => unwrap(request<ApiEnvelope<FarmOption[]>>('/api/farms/admin/all')),
      getLocations: (state: 'green' | 'roasted') =>
        unwrap(request<ApiEnvelope<StorageLocation[]>>(`/api/storage/locations?state=${state}&include_blocked=0`)),
      getSupplies: () => unwrap(request<ApiEnvelope<PackagingSupply[]>>('/api/costs/supplies/list')),
    },

    labels: {
      generateFromPackaging: (input: GenerateLabelsInput) =>
        request<{ success: boolean; message?: string; labels: unknown[] }>('/api/labels/generate-from-lot', {
          method: 'POST',
          body: input,
        }),
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
