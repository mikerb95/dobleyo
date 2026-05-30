import type { ProductionStage } from './types';

/** Orden y metadatos de las etapas de la línea de producción. */
export const PRODUCTION_STAGES: ReadonlyArray<{
  stage: ProductionStage;
  label: string;
  /** Endpoint POST que registra el avance hacia/dentro de esta etapa. */
  endpoint: string;
}> = [
  { stage: 'harvest', label: 'Cosecha', endpoint: '/api/coffee/harvest' },
  { stage: 'green-storage', label: 'Almacén verde', endpoint: '/api/coffee/inventory-storage' },
  { stage: 'roasting', label: 'Enviar a tueste', endpoint: '/api/coffee/send-roasting' },
  { stage: 'roasted', label: 'Recibir tostado', endpoint: '/api/coffee/roast-retrieval' },
  { stage: 'roasted-storage', label: 'Almacén tostado', endpoint: '/api/coffee/roasted-storage' },
  { stage: 'packaged', label: 'Empaque', endpoint: '/api/coffee/packaging' },
];

/** Roles con acceso a la app operativa móvil. */
export const OPERATIONAL_ROLES = ['admin', 'caficultor'] as const;

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min (espejo del backend)
