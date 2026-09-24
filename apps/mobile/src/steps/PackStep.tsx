import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  GRIND_SIZES, PACKAGE_SIZES, formatKg, formatLongDate, formatNumber, formatShortDate, todayISO, unitsLabel,
  type PackagingInput, type StepResult,
} from '@dobleyo/shared';
import { api } from '../lib/api';
import { mutationKeys } from '../lib/mutations';
import { errorMessage, submitStep, useStepMutation, useSupplies } from '../lib/workflow';
import { Amount, Check, Chips, DateChips, DotScale, Field, More, Note, Section, TextArea } from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import { QUEUED_NOTE, type StepProps } from './types';

const MIN_PACKAGE_KG = 0.1;

/**
 * El tostado se empaca y, en el mismo movimiento, se generan sus etiquetas.
 * Las etiquetas necesitan el id del empaque: sin señal quedan para después.
 */
export default function PackStep({ lot, role, onDone, onCancel, roastedStorageId }: StepProps & { roastedStorageId?: number }) {
  const isAdmin = role === 'admin';
  const supplies = useSupplies(isAdmin);
  const mutation = useStepMutation<PackagingInput, StepResult>(mutationKeys.packaging);
  const task = lot.tasks.find((t) => t.kind === 'pack' && t.ref.roastedStorageId === roastedStorageId);
  const available = task?.facts.kg ?? 0;
  const profile = lot.suggestedProfile;

  const [presentation, setPresentation] = useState<'GRANO' | 'MOLIDO'>('GRANO');
  const [grind, setGrind] = useState('');
  const [size, setSize] = useState<PackagingInput['packageSize']>('250g');
  const [units, setUnits] = useState('');
  const [acidity, setAcidity] = useState(profile?.acidity ?? 3);
  const [body, setBody] = useState(profile?.body ?? 3);
  const [balance, setBalance] = useState(profile?.balance ?? 3);
  const [toStore, setToStore] = useState(true);
  const [withLabels, setWithLabels] = useState(true);
  const [withQr, setWithQr] = useState(true);
  const [bag, setBag] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulk = size === 'bulk';
  const sizeKg = PACKAGE_SIZES.find((p) => p.value === size)?.kg ?? 1;
  const maxUnits = Math.floor((available + 1e-9) / sizeKg);
  const n = parseInt(units, 10);
  const consumed = n > 0 ? Math.round(n * sizeKg * 1000) / 1000 : 0;
  const remaining = Math.max(0, Math.round((available - consumed) * 1000) / 1000);

  const bagOptions = (supplies.data ?? []).filter((x) => x.type === 'bolsa');
  const labelOptions = (supplies.data ?? []).filter((x) => x.type === 'etiqueta');
  useEffect(() => {
    const match = bagOptions.find((b) => b.size_label === size);
    setBag(match ? String(match.id) : '');
    if (!label && labelOptions.length === 1) setLabel(String(labelOptions[0]!.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, supplies.data]);

  if (!task) {
    return (
      <StepScreen title="Este paso ya no está pendiente" submitLabel="Volver" onSubmit={onCancel} onCancel={onCancel}>
        <Note>Este tostado ya no tiene peso disponible para empacar.</Note>
      </StepScreen>
    );
  }

  let consequence = null;
  if (n > maxUnits) consequence = <>Con {formatKg(available)} alcanzan como máximo {maxUnits} {bulk ? 'kg' : 'bolsas'}.</>;
  else if (n > 0) {
    const tail = remaining >= MIN_PACKAGE_KG ? `Quedan ${formatKg(remaining)}.`
      : remaining > 0 ? `El sobrante (${formatNumber(remaining * 1000)} g) no alcanza para otra bolsa.`
      : 'Se empaca todo el tostado.';
    consequence = <><Text style={stepStyles.strong}>{unitsLabel(n, size)}</Text>{bulk ? '' : `, ${formatKg(consumed)}`}. {tail}</>;
  }

  async function submit() {
    setError(null);
    if (presentation === 'MOLIDO' && !grind) return setError('Elija el tipo de molienda.');
    if (!(n > 0)) return setError(bulk ? 'Escriba cuántos kilos se despachan a granel.' : 'Escriba cuántas bolsas se empacan.');
    if (n > maxUnits) return setError(`Con ${formatKg(available)} alcanzan como máximo ${maxUnits} ${bulk ? 'kg' : 'bolsas'}.`);
    setBusy(true);

    let out;
    try {
      out = await submitStep(mutation, {
        roastedStorageId: roastedStorageId!, acidity, body, balance, presentation,
        grindSize: presentation === 'MOLIDO' ? grind : undefined,
        packageSize: size, unitCount: n, notes: notes.trim() || undefined,
        addToInventory: toStore, recordedAt: date,
        ...(isAdmin && !bulk ? { bagSupplyId: bag ? Number(bag) : null, labelSupplyId: label ? Number(label) : null } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    const style = bulk ? '' : presentation === 'MOLIDO' ? ', molido' : ', en grano';
    const base = `${unitsLabel(n, size)}${style} del lote de ${lot.farmName}.`;
    if (out.queued) {
      return onDone({
        lotId: lot.lotId, title: 'Empaque guardado', queued: true,
        detail: `${base} ${QUEUED_NOTE}${withLabels && !bulk ? ' Las etiquetas se generan cuando llegue al servidor.' : ''}`,
      });
    }

    // Segundo registro: si falla, el empaque ya quedó y la tarea "Etiquetar" lo recoge.
    let labelNote = '';
    let printable = false;
    if (withLabels && !bulk && out.result.packagedId) {
      try {
        await api.labels.generateFromPackaging({ lotId: out.result.packagedId, quantity: n, includeQR: withQr });
        labelNote = ` Se generaron ${n} ${n === 1 ? 'etiqueta' : 'etiquetas'}.`;
        printable = true;
      } catch (err) {
        labelNote = ` No se generaron las etiquetas (${errorMessage(err)}). Quedan pendientes en Qué sigue.`;
      }
    }
    onDone({ lotId: lot.lotId, title: 'Café empacado', detail: base + labelNote, printLabels: printable });
  }

  return (
    <StepScreen
      lot={`Lote ${lot.lotId}`}
      title={`Empacar el tostado de ${lot.farmName}`}
      intro={`${formatKg(available)} listos${task.facts.location ? ` en ${task.facts.location}` : ''}, tostado ${task.ageDays ? `hace ${task.ageDays} días` : 'hoy'}.`}
      consequence={consequence}
      error={error}
      submitLabel={withLabels && !bulk ? 'Empacar y etiquetar' : 'Empacar'}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      {task.urgency === 'waiting' ? (
        <Note>Este tostado sigue en reposo. Para que el café desgasifique, lo ideal es empacarlo desde el {formatShortDate(task.facts.readyAt)}.</Note>
      ) : null}

      <Section title="Cómo se presenta">
        <Chips label="Presentación" options={[{ value: 'GRANO', label: 'En grano' }, { value: 'MOLIDO', label: 'Molido' }]}
          value={presentation} onChange={(v) => setPresentation(v as 'GRANO' | 'MOLIDO')} />
        {presentation === 'MOLIDO' ? <Chips label="Molienda" options={GRIND_SIZES} value={grind} onChange={setGrind} /> : null}
        <Chips label="Tamaño" options={PACKAGE_SIZES.map((p) => ({ value: p.value, label: p.label }))} value={size}
          onChange={(v) => { setSize(v as PackagingInput['packageSize']); setUnits(''); }} />
        <Field label={bulk ? 'Kilos a granel' : 'Cuántas bolsas'}
          hint={maxUnits > 0 ? `Alcanza para ${maxUnits} ${bulk ? 'kg' : maxUnits === 1 ? 'bolsa' : 'bolsas'}.` : 'No alcanza para este tamaño.'}>
          <Amount value={units} onChange={setUnits} decimals={false} unit={bulk ? 'kg' : 'bolsas'}
            action={maxUnits > 0 && n !== maxUnits ? { label: 'Todo', onPress: () => setUnits(String(maxUnits)) } : null} />
        </Field>
      </Section>

      <Section
        title="Perfil de la etiqueta"
        aside={profile ? `De la catación del ${formatLongDate(profile.cuppedAt)}` : 'Sin catación: ajústelo a mano'}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <DotScale label="Acidez" value={acidity} onChange={setAcidity} low="Suave" high="Brillante" />
          <DotScale label="Cuerpo" value={body} onChange={setBody} low="Ligero" high="Denso" />
          <DotScale label="Balance" value={balance} onChange={setBalance} low="Marcado" high="Redondo" />
        </View>
      </Section>

      {!bulk ? (
        <Section title="Etiquetas">
          <Check label={`Generar ${n > 0 ? n : 'las'} ${n === 1 ? 'etiqueta' : 'etiquetas'} al empacar`} value={withLabels} onChange={setWithLabels} />
          {withLabels ? <Check label="Con código QR de trazabilidad" value={withQr} onChange={setWithQr} /> : null}
        </Section>
      ) : null}

      {isAdmin && !bulk && (bagOptions.length > 0 || labelOptions.length > 0) ? (
        <Section title="Insumos">
          <Chips label="Bolsa" options={[{ value: '', label: 'Sin registrar' }, ...bagOptions.map((b) => ({ value: String(b.id), label: b.name }))]}
            value={bag} onChange={setBag} />
          <Chips label="Etiqueta" options={[{ value: '', label: 'Sin registrar' }, ...labelOptions.map((b) => ({ value: String(b.id), label: b.name }))]}
            value={label} onChange={setLabel} />
        </Section>
      ) : null}

      <Check label="Agregar las unidades al inventario de la tienda" value={toStore} onChange={setToStore} />

      <More summary="Fecha y notas del empaque">
        <DateChips label="Fecha de empaque" value={date} onChange={setDate} />
        <TextArea value={notes} onChange={setNotes} placeholder="Válvula, sellado, observaciones" />
      </More>
    </StepScreen>
  );
}
