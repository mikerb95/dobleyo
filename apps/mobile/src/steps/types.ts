import type { LotJourney } from '@dobleyo/shared';

/** Lo que cada paso reporta al terminar, para la pantalla de cierre. */
export interface StepDone {
  lotId?: string;
  title: string;
  detail: string;
  /** Quedó en la cola del teléfono: se envía al recuperar la señal. */
  queued?: boolean;
  /** Se generaron etiquetas listas para imprimir. */
  printLabels?: boolean;
}

export interface StepProps {
  lot: LotJourney;
  role: string | undefined;
  onDone: (done: StepDone) => void;
  onCancel: () => void;
}

export const QUEUED_NOTE = 'Quedó guardado en el teléfono y se enviará cuando haya señal.';
