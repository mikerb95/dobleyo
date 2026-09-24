import { useState } from 'react';
import { Text } from 'react-native';
import { formatKg, formatNumber, todayISO, type GreenStorageInput, type StepResult } from '@dobleyo/shared';
import { mutationKeys } from '../lib/mutations';
import { costPayload, errorMessage, num, submitStep, useLocations, useStepMutation } from '../lib/workflow';
import { Amount, CostBlock, DateChips, Field, LocationPicker, More, Section, TextArea, emptyCost } from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import { QUEUED_NOTE, type StepProps } from './types';

/** El café de finca entra a la bodega de café verde. */
export default function GreenStep({ lot, role, onDone, onCancel }: StepProps) {
  const isAdmin = role === 'admin';
  const locations = useLocations('green');
  const mutation = useStepMutation<GreenStorageInput, StepResult>(mutationKeys.greenStorage);
  const [kg, setKg] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weight = num(kg);
  const bought = lot.harvestKg;
  const shrink = bought && weight > 0 ? ((bought - weight) / bought) * 100 : null;

  let consequence = null;
  if (weight > 0 && shrink != null && shrink >= 0) {
    consequence = <>De {formatKg(bought)} comprados entran {formatKg(weight)}: merma del <Text style={stepStyles.strong}>{formatNumber(shrink)} %</Text>.</>;
  } else if (weight > 0 && shrink != null) {
    consequence = <>Entra más de lo comprado ({formatKg(bought)}). Revise el peso antes de guardar.</>;
  } else if (weight > 0) {
    consequence = <>Entrarán <Text style={stepStyles.strong}>{formatKg(weight)}</Text>{location ? ` a ${location}` : ''}.</>;
  }

  async function submit() {
    if (!(weight > 0)) return setError('Escriba cuántos kilos entran a bodega.');
    if (!location) return setError('Elija dónde queda guardado.');
    setError(null);
    setBusy(true);
    try {
      const out = await submitStep(mutation, {
        lotId: lot.lotId, weight, weightUnit: 'kg', location, storageDate: date, recordedAt: date,
        notes: notes.trim() || undefined,
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: 'Café guardado en bodega',
        detail: `${formatKg(weight)} de ${lot.farmName} en ${location}.${out.queued ? ` ${QUEUED_NOTE}` : ''}`,
        queued: out.queued,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StepScreen
      lot={`Lote ${lot.lotId}`}
      title={`Guardar en bodega el café de ${lot.farmName}`}
      intro="Pese lo que llega y elija el estante. Desde aquí el café ya se puede enviar a la maquila."
      consequence={consequence}
      error={error}
      submitLabel="Ingresar a bodega"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Cuánto entra">
        <Field label="Peso en báscula" hint={bought ? `Se compraron ${formatKg(bought)} al caficultor.` : undefined}>
          <Amount value={kg} onChange={setKg} unit="kg" placeholder={bought ? String(Math.round(bought * 0.9)) : '110'} />
        </Field>
        <DateChips label="Fecha de ingreso" value={date} onChange={setDate} />
      </Section>
      <Section title="Dónde queda">
        <LocationPicker label="Ubicación" locations={locations.data} loading={locations.isLoading}
          error={locations.error} value={location} onChange={setLocation} neededKg={weight} />
      </Section>
      {isAdmin ? <CostBlock title="Transporte de finca a bodega" cost={cost} onChange={setCost} /> : null}
      <More summary="Agregar una nota">
        <TextArea value={notes} onChange={setNotes} placeholder="Humedad, estado de los sacos, observaciones" />
      </More>
    </StepScreen>
  );
}
