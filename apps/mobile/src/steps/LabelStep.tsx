import { useState } from 'react';
import { Text } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/mutations';
import { errorMessage } from '../lib/workflow';
import { Amount, Check, Field, Note, Section } from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import type { StepProps } from './types';

/** Bolsas empacadas que quedaron sin etiqueta. Requiere señal. */
export default function LabelStep({ lot, onDone, onCancel }: StepProps) {
  const task = lot.tasks.find((t) => t.kind === 'label');
  const [qty, setQty] = useState(String(task?.ref.quantity ?? ''));
  const [withQr, setWithQr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!task?.ref.packagedId) {
    return (
      <StepScreen title="Este paso ya no está pendiente" submitLabel="Volver" onSubmit={onCancel} onCancel={onCancel}>
        <Note>Este lote no tiene bolsas pendientes de etiqueta.</Note>
      </StepScreen>
    );
  }
  const n = parseInt(qty, 10);

  async function submit() {
    if (!onlineManager.isOnline()) return setError('Generar etiquetas requiere señal. Intente de nuevo cuando tenga conexión.');
    if (!(n > 0)) return setError('Escriba cuántas etiquetas necesita.');
    if (n > 1000) return setError('Se pueden generar hasta 1.000 etiquetas por vez.');
    setError(null);
    setBusy(true);
    try {
      await api.labels.generateFromPackaging({ lotId: task!.ref.packagedId!, quantity: n, includeQR: withQr });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflow });
      onDone({
        lotId: lot.lotId,
        title: 'Etiquetas generadas',
        detail: `${n} ${n === 1 ? 'etiqueta lista' : 'etiquetas listas'} para las bolsas de ${lot.farmName}.`,
        printLabels: true,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StepScreen
      lot={`Lote ${lot.lotId}`}
      title={`Etiquetar las bolsas de ${lot.farmName}`}
      intro={task.facts.missing === 1 ? 'Hay 1 bolsa empacada sin etiqueta.' : `Hay ${task.facts.missing} bolsas empacadas sin etiqueta.`}
      consequence={n > 0 ? <>Se generarán <Text style={stepStyles.strong}>{n}</Text> {n === 1 ? 'etiqueta' : 'etiquetas'}.</> : null}
      error={error}
      submitLabel="Generar etiquetas"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Cuántas">
        <Field label="Etiquetas" hint={`Del último empaque faltan ${task.ref.quantity}.`}>
          <Amount value={qty} onChange={setQty} decimals={false} unit="etiquetas" />
        </Field>
        <Check label="Con código QR de trazabilidad" value={withQr} onChange={setWithQr} />
      </Section>
    </StepScreen>
  );
}
