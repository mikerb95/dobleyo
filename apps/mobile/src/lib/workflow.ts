import { onlineManager, useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { ApiError, type WithClientOpId } from '@dobleyo/shared';
import { api } from './api';
import { queryKeys, withOpId } from './mutations';

// ── Lecturas del flujo guiado ───────────────────────────────────────────────
// Todas quedan en la caché persistida: sin señal se sigue viendo la última
// bandeja y la ficha de cada lote abierto.

export function useQueue() {
  return useQuery({ queryKey: queryKeys.queue, queryFn: () => api.workflow.getQueue() });
}

export function useLot(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lot(lotId ?? ''),
    queryFn: () => api.workflow.getLot(lotId!),
    enabled: !!lotId,
  });
}

export function useLocations(state: 'green' | 'roasted') {
  return useQuery({
    queryKey: queryKeys.locations(state),
    queryFn: () => api.catalog.getLocations(state),
    staleTime: 1000 * 60 * 30,
  });
}

// Fincas históricas: el servidor resuelve su región y altura (FARM_MAP).
const FALLBACK_FARMS = [
  { id: -1, slug: 'finca-la-sierra', name: 'La Sierra', municipality: 'Huila', region: 'HUI', altitude_min: 1800 },
  { id: -2, slug: 'finca-nariño', name: 'Nariño Premium', municipality: 'Nariño', region: 'NAR', altitude_min: 1900 },
  { id: -3, slug: 'finca-cauca', name: 'Cauca Estate', municipality: 'Cauca', region: 'CAU', altitude_min: 1750 },
];

/** Fincas para la cosecha: el admin ve todas, el caficultor las suyas. */
export function useFarms(role: string | undefined) {
  const q = useQuery({
    queryKey: queryKeys.farms(role ?? ''),
    queryFn: () => (role === 'admin' ? api.catalog.getAllFarms() : api.catalog.getMyFarms()),
    enabled: !!role,
    staleTime: 1000 * 60 * 60,
  });
  const list = (q.data ?? []).filter((f) => f.slug);
  return { ...q, farms: q.isLoading ? [] : list.length ? list : FALLBACK_FARMS };
}

/** Insumos de empaque; solo el admin los consulta (al caficultor le da 403). */
export function useSupplies(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.supplies,
    queryFn: () => api.catalog.getSupplies(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

// ── Envío de pasos ──────────────────────────────────────────────────────────

export type StepOutcome<T> = { queued: true } | { queued: false; result: T };

/**
 * Registra un paso. Con señal espera la respuesta (para mostrar errores de
 * negocio y encadenar el siguiente registro). Sin señal lo deja en la cola
 * persistida: se envía solo al reconectar, con el mismo client_op_id para
 * que el reintento no duplique el registro.
 */
export async function submitStep<TInput, TResult>(
  mutation: UseMutationResult<TResult, Error, TInput & WithClientOpId>,
  input: TInput,
): Promise<StepOutcome<TResult>> {
  const payload = withOpId(input);
  if (!onlineManager.isOnline()) {
    mutation.mutate(payload);
    return { queued: true };
  }
  const result = await mutation.mutateAsync(payload);
  return { queued: false, result };
}

/** Mutación ligada a los defaults de la cola offline (src/lib/mutations.ts). */
export function useStepMutation<TInput, TResult = unknown>(mutationKey: readonly string[]) {
  return useMutation<TResult, Error, TInput & WithClientOpId>({ mutationKey });
}

/** Mensaje legible de un error de API o de red. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Su sesión expiró. Vuelva a ingresar.';
    return err.message;
  }
  if (err instanceof Error && /network|fetch/i.test(err.message)) {
    return 'No hay conexión con el servidor. Revise la señal e intente de nuevo.';
  }
  return err instanceof Error ? err.message : 'No se pudo guardar el registro.';
}

/** Lee un número escrito con coma o punto decimal. */
export function num(value: string): number {
  if (!value) return NaN;
  return parseFloat(value.replace(',', '.'));
}

/** Costo del paso listo para el payload, o undefined si no se digitó. */
export function costPayload(cost: { amount: string; method: 'caja' | 'banco' | 'credito' }) {
  const amount = Number(cost.amount.replace(/[^\d]/g, ''));
  return amount > 0 ? { amount, paymentMethod: cost.method } : undefined;
}
