import { Linking } from 'react-native';
import type { WorkflowTask } from '@dobleyo/shared';
import { API_BASE_URL } from '../config';

type Router = { push: (href: never) => void; replace: (href: never) => void };

/** Ruta de la pantalla del paso, con la referencia que ese paso necesita. */
export function taskHref(task: WorkflowTask): string {
  const params = new URLSearchParams({ lotId: task.lotId });
  for (const [k, v] of Object.entries(task.ref)) {
    if (v != null && k !== 'lotId') params.set(k, String(v));
  }
  return `/(app)/paso/${task.kind}?${params.toString()}`;
}

/**
 * Abre el paso de una tarea. La catación usa el formulario SCA completo del
 * panel web, que en el teléfono se abre en el navegador.
 */
export function openTask(router: Router, task: WorkflowTask, mode: 'push' | 'replace' = 'push') {
  if (task.kind === 'cupping') {
    void Linking.openURL(`${API_BASE_URL}/admin/cupping?tostado=${encodeURIComponent(String(task.ref.roastedId))}`);
    return;
  }
  router[mode](taskHref(task) as never);
}
