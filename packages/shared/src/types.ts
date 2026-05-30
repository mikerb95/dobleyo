// Tipos de dominio compartidos entre la app móvil y (a futuro) la web.
// Derivados de db/schema.sql y de los contratos de server/routes/*.

export type UserRole = 'admin' | 'client' | 'provider' | 'caficultor';

export interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  role: UserRole;
  email?: string;
  caficultor_status?: 'pending' | 'approved' | 'rejected' | null;
}

export interface LoginResponse {
  message: string;
  token: string;
  /** Presente solo cuando el cliente lo solicita por header/body (flujo móvil). */
  refresh_token?: string;
  user: AuthUser;
}

export interface RefreshResponse {
  message: string;
  token: string;
  refresh_token?: string;
  user?: Partial<AuthUser>;
}

// ---- Línea de producción (etapas del grano) ----

export type ProductionStage =
  | 'harvest'
  | 'green-storage'
  | 'roasting'
  | 'roasted'
  | 'roasted-storage'
  | 'packaged';

export interface Lot {
  id: number | string;
  code?: string;
  farm?: string;
  region?: string;
  variety?: string;
  process?: string;
  stage?: ProductionStage | string;
  created_at?: string;
}

export interface Harvest {
  id: number | string;
  farm: string;
  region: string;
  altitude?: number | string;
  variety?: string;
  climate?: string;
  process?: string;
  aroma?: string;
  tasteNotes?: string;
  created_at?: string;
}

export interface RoastBatch {
  id: number | string;
  lotId: number | string;
  quantitySent?: number;
  targetTemp?: number;
  roastLevel?: string;
  roastDate?: string;
  notes?: string;
}

export interface PackagedItem {
  id: number | string;
  lotId: number | string;
  packageWeight: number;
  packageType: string;
  quantity: number;
  notes?: string;
}

export interface Cupping {
  id: number | string;
  lotId: number | string;
  score: number;
  aromaScore?: number;
  flavorScore?: number;
  acidityScore?: number;
  bodyScore?: number;
  notes?: string;
}

// ---- Inventario ----

export interface InventoryProduct {
  id: number | string;
  name: string;
  sku?: string;
  category?: string;
  stock?: number;
  price?: number;
  unit?: string;
}

export interface StockItem {
  id: number | string;
  name: string;
  available?: number;
}

// ---- Payloads de escritura (línea de producción) ----

export interface HarvestInput {
  farm: string;
  region: string;
  altitude?: number | string;
  variety?: string;
  climate?: string;
  process?: string;
  aroma?: string;
  tasteNotes?: string;
}

export interface GreenStorageInput {
  lotId: number | string;
  weight: number;
  weightUnit?: string;
  location?: string;
  storageDate?: string;
  notes?: string;
}

export interface SendRoastingInput {
  lotId: number | string;
  quantitySent: number;
  targetTemp?: number;
  notes?: string;
}

export interface RoastRetrievalInput {
  lotId: number | string;
  roastedWeight: number;
  roastLevel?: string;
  roastDate?: string;
  notes?: string;
}

export interface RoastedStorageInput {
  lotId: number | string;
  weight: number;
  location?: string;
  notes?: string;
}

export interface PackagingInput {
  lotId: number | string;
  packageWeight: number;
  packageType: string;
  quantity: number;
  notes?: string;
}

export interface CuppingInput {
  lotId: number | string;
  score: number;
  aromaScore?: number;
  flavorScore?: number;
  acidityScore?: number;
  bodyScore?: number;
  notes?: string;
}

/**
 * Identificador de operación generado por el cliente para idempotencia
 * de la cola offline: evita duplicar registros al reintevar una mutación.
 */
export interface WithClientOpId {
  client_op_id?: string;
}

// ---- Sobre de respuesta estándar del backend ----

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
