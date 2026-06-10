import * as Crypto from 'expo-crypto';
import type {
  CuppingInput,
  GreenStorageInput,
  HarvestInput,
  PackagingInput,
  RoastRetrievalInput,
  RoastedStorageInput,
  SendRoastingInput,
  WithClientOpId,
} from '@dobleyo/shared';
import { queryClient } from './queryClient';
import { api } from './api';

// Claves de queries de la línea de producción (listas por etapa).
export const queryKeys = {
  harvests: ['production', 'harvests'] as const,
  greenInventory: ['production', 'green-inventory'] as const,
  roastingBatches: ['production', 'roasting-batches'] as const,
  roastedCoffee: ['production', 'roasted-coffee'] as const,
  packaged: ['production', 'packaged'] as const,
  lots: ['production', 'lots'] as const,
};

// Claves de mutaciones. Las mutaciones pausadas offline se persisten en
// AsyncStorage y al reanudarse (tras reinicio) recuperan su mutationFn
// por esta clave — por eso los defaults se registran al importar el módulo.
export const mutationKeys = {
  harvest: ['mutation', 'harvest'] as const,
  greenStorage: ['mutation', 'green-storage'] as const,
  sendRoasting: ['mutation', 'send-roasting'] as const,
  roastRetrieval: ['mutation', 'roast-retrieval'] as const,
  roastedStorage: ['mutation', 'roasted-storage'] as const,
  packaging: ['mutation', 'packaging'] as const,
  cupping: ['mutation', 'cupping'] as const,
};

/**
 * Adjunta el client_op_id de idempotencia. Se genera AL ENCOLAR (no al
 * enviar): persiste con la mutación y el reintento manda el mismo ID,
 * de modo que el servidor no duplica el registro.
 */
export function withOpId<T>(input: T): T & WithClientOpId {
  return { ...input, client_op_id: Crypto.randomUUID() };
}

function invalidate(...keys: ReadonlyArray<readonly string[]>) {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

queryClient.setMutationDefaults(mutationKeys.harvest, {
  mutationFn: (input: HarvestInput & WithClientOpId) => api.production.createHarvest(input),
  onSuccess: () => invalidate(queryKeys.harvests, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.greenStorage, {
  mutationFn: (input: GreenStorageInput & WithClientOpId) => api.production.storeGreen(input),
  onSuccess: () => invalidate(queryKeys.harvests, queryKeys.greenInventory, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.sendRoasting, {
  mutationFn: (input: SendRoastingInput & WithClientOpId) => api.production.sendRoasting(input),
  onSuccess: () => invalidate(queryKeys.greenInventory, queryKeys.roastingBatches, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.roastRetrieval, {
  mutationFn: (input: RoastRetrievalInput & WithClientOpId) => api.production.receiveRoasted(input),
  onSuccess: () => invalidate(queryKeys.roastingBatches, queryKeys.roastedCoffee, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.roastedStorage, {
  mutationFn: (input: RoastedStorageInput & WithClientOpId) => api.production.storeRoasted(input),
  onSuccess: () => invalidate(queryKeys.roastedCoffee, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.packaging, {
  mutationFn: (input: PackagingInput & WithClientOpId) => api.production.packaging(input),
  onSuccess: () => invalidate(queryKeys.packaged, queryKeys.lots),
});

queryClient.setMutationDefaults(mutationKeys.cupping, {
  mutationFn: (input: CuppingInput & WithClientOpId) => api.production.createCupping(input),
  onSuccess: () => invalidate(queryKeys.lots),
});
