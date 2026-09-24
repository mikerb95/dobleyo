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

// ---- Costeo de producción ----

/** Cómo se pagó un costo. Determina la cuenta acreditada del asiento. */
export type CostPaymentMethod = 'caja' | 'banco' | 'credito';

/**
 * Costo de un paso de la línea de producción.
 *
 * Es opcional en todos los pasos: sin él, el registro se guarda igual y el lote
 * queda marcado como costeo incompleto. El backend lo descarta si quien lo
 * envía no es admin.
 */
export interface StageCostInput {
  /** Monto total en COP. */
  amount: number;
  paymentMethod?: CostPaymentMethod;
  /** Caficultor o proveedor, para el crédito a cuentas por pagar. */
  partnerId?: number;
  notes?: string;
}

// ---- Payloads de escritura (línea de producción) ----

export interface HarvestInput {
  /** Fecha del registro (`YYYY-MM-DD`). Permite digitar el paso días después. */
  recordedAt?: string;
  /** Slug de la finca (farms.slug). */
  farm: string;
  region?: string;
  altitude?: number | string;
  variety: string;
  climate: string;
  process: string;
  /** Opcional: el perfil sensorial se describe mejor en la catación. */
  aroma?: string;
  tasteNotes?: string;
  /** Kilos recibidos del caficultor. Denominador del costo de origen. */
  harvestWeightKg?: number | string;
  /** Pago al caficultor. */
  cost?: StageCostInput;
}

export interface GreenStorageInput {
  recordedAt?: string;
  lotId: string;
  weight: number;
  weightUnit?: 'kg' | 'lb';
  /** Código de ubicación del maestro de bodega (apta para café verde). */
  location: string;
  storageDate: string;
  notes?: string;
  /** Transporte de la carga desde la finca hasta la bodega. */
  cost?: StageCostInput;
}

export interface SendRoastingInput {
  recordedAt?: string;
  lotId: string;
  quantitySent: number;
  targetTemp?: number;
  notes?: string;
  /** Transporte de la bodega hacia la tostadora. */
  cost?: StageCostInput;
}

export interface RoastRetrievalInput {
  recordedAt?: string;
  /** Envío a maquila que regresa (roasting_batches.id). */
  roastingId: number;
  roastLevel: 'LIGHT' | 'MEDIUM' | 'DARK';
  roastedWeight: number;
  actualTemp?: number;
  roastTime?: number;
  observations?: string;
  /** Maquila del proceso de tostión. */
  cost?: StageCostInput;
}

export interface RoastedStorageInput {
  recordedAt?: string;
  /** Café tostado recibido (roasted_coffee.id). */
  roastedId: number;
  /** Código de ubicación apta para café tostado. */
  location: string;
  container: string;
  containerCount: number;
  conditions?: string[];
  notes?: string;
  /** Transporte de retorno desde la tostadora hasta la bodega. */
  cost?: StageCostInput;
}

export interface PackagingInput {
  recordedAt?: string;
  /** Tostado en bodega (roasted_coffee_inventory.id). */
  roastedStorageId: number;
  /** Perfil 1–5 que va en la etiqueta. */
  acidity: number;
  body: number;
  balance: number;
  presentation: 'GRANO' | 'MOLIDO';
  grindSize?: string | null;
  packageSize: '100g' | '250g' | '500g' | '1kg' | 'bulk';
  /** Bolsas; a granel, kilos. */
  unitCount: number;
  notes?: string;
  addToInventory?: boolean;
  /**
   * Insumos consumidos, del maestro `packaging_supplies`. El costo sale del
   * maestro (no se digita) y descuenta stock. A granel no aplican.
   */
  bagSupplyId?: number | null;
  labelSupplyId?: number | null;
}

export interface CuppingInput {
  roastedId: number;
  checkDate: string;
  checkType?: 'post_tostado' | 'catacion' | 'final';
  aromaScore?: number;
  flavorScore?: number;
  aftertasteScore?: number;
  acidityScore?: number;
  bodyScore?: number;
  balanceScore?: number;
  uniformityScore?: number;
  cleanCupScore?: number;
  sweetnessScore?: number;
  defectsCount?: number;
  observations?: string;
  passed?: boolean;
}

export interface GenerateLabelsInput {
  /** Registro de empaque (packaged_coffee.id). */
  lotId: number;
  quantity: number;
  includeQR?: boolean;
}

export interface StorageLocation {
  id: number;
  code: string;
  name: string;
  zone_name: string;
  capacity_kg: number | null;
  occupied_kg: number;
  is_blocked: number | boolean;
  fill_pct: number | null;
}

export interface FarmOption {
  id: number;
  slug: string | null;
  name: string;
  region: string | null;
  municipality: string | null;
  altitude_min: number | null;
}

export interface PackagingSupply {
  id: number;
  name: string;
  type: 'bolsa' | 'etiqueta' | string;
  /** Tamaño al que corresponde la bolsa ('250g', '500g'...). */
  size_label: string | null;
  unit_cost_cop: number;
  stock_units: number;
}

/** Respuesta de los POST de /api/coffee/*: el dato viene al lado de success. */
export interface StepResult {
  success: boolean;
  message?: string;
  error?: string;
  lotId?: string;
  roastingId?: number;
  roastedId?: number;
  storageId?: number;
  packagedId?: number;
  weightLossPercent?: number;
  remainingKg?: number;
  lotExhausted?: boolean;
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
