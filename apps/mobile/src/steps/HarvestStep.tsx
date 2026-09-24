import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import {
  CLIMATE_LABELS, VARIETY_LABELS, formatKg, todayISO, type HarvestInput, type StepResult,
} from '@dobleyo/shared';
import { mutationKeys } from '../lib/mutations';
import { costPayload, errorMessage, num, submitStep, useFarms, useStepMutation } from '../lib/workflow';
import { Amount, Chips, CostBlock, DateChips, Field, More, Section, emptyCost, styles as f } from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import { QUEUED_NOTE, type StepDone } from './types';

const toOptions = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));
const VARIETIES = toOptions(VARIETY_LABELS);
const CLIMATES = toOptions(CLIMATE_LABELS);
const PROCESSES = [
  { value: 'HUM', label: 'Lavado' },
  { value: 'NAT', label: 'Natural', hint: 'secado en cereza' },
  { value: 'ANH', label: 'Anaeróbico' },
];

/** Primer paso: el café llega de la finca y nace el lote. */
export default function HarvestStep({ role, onDone, onCancel }: {
  role: string | undefined; onDone: (d: StepDone) => void; onCancel: () => void;
}) {
  const isAdmin = role === 'admin';
  const { farms, isLoading } = useFarms(role);
  const mutation = useStepMutation<HarvestInput, StepResult>(mutationKeys.harvest);

  const [farmSlug, setFarmSlug] = useState('');
  const [date, setDate] = useState(todayISO);
  const [variety, setVariety] = useState('');
  const [process, setProcess] = useState('');
  const [climate, setClimate] = useState('');
  const [kg, setKg] = useState('');
  const [aroma, setAroma] = useState('');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const farm = farms.find((x) => x.slug === farmSlug) ?? (farms.length === 1 ? farms[0] : undefined);
  const preview = farm
    ? `${['COL', farm.region || 'COL', farm.altitude_min || '', variety, process].filter(Boolean).join('-')}-XXXX`
    : null;

  async function submit() {
    const missing = [!farm && 'la finca', !variety && 'la variedad', !process && 'el proceso', !climate && 'el clima'].filter(Boolean);
    if (missing.length) return setError(`Falta elegir ${missing.join(', ')}.`);
    const kgNum = num(kg);
    if (kg && !(kgNum > 0)) return setError('Los kilos comprados deben ser un número mayor que cero.');
    setError(null);
    setBusy(true);
    try {
      const out = await submitStep(mutation, {
        farm: farm!.slug!,
        region: farm!.region ?? undefined,
        altitude: farm!.altitude_min ?? undefined,
        variety, process, climate,
        aroma: aroma.trim() || undefined,
        tasteNotes: notes.trim() || undefined,
        recordedAt: date,
        ...(isAdmin && kgNum > 0 ? { harvestWeightKg: kgNum } : {}),
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone(out.queued
        ? { title: 'Cosecha guardada', detail: `${QUEUED_NOTE} El código del lote se asigna al llegar al servidor.`, queued: true }
        : { lotId: out.result.lotId, title: 'Lote creado', detail: `El café de ${farm!.name} ya tiene código: ${out.result.lotId}.` });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StepScreen
      title="Registrar una cosecha"
      intro="El café que llega de la finca abre un lote nuevo. Con él se sigue el grano hasta la bolsa."
      consequence={preview ? <>Se creará el lote <Text style={stepStyles.strong}>{preview}</Text></> : 'Elija la finca para ver el código del lote.'}
      error={error}
      submitLabel="Crear lote"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="De dónde viene">
        {isLoading ? <Text style={f.hint}>Cargando fincas…</Text> : (
          <Chips
            label="Finca"
            options={farms.map((x) => ({
              value: x.slug!,
              label: x.name,
              hint: [x.municipality, x.altitude_min ? `${x.altitude_min} m` : null].filter(Boolean).join(', '),
            }))}
            value={farm?.slug ?? ''}
            onChange={setFarmSlug}
          />
        )}
        <DateChips label="Fecha de recolección" value={date} onChange={setDate} />
      </Section>

      <Section title="Qué café es">
        <Chips label="Variedad" options={VARIETIES} value={variety} onChange={setVariety} />
        <Chips label="Proceso" options={PROCESSES} value={process} onChange={setProcess} />
        <Chips label="Clima durante la recolección" options={CLIMATES} value={climate} onChange={setClimate} />
      </Section>

      {isAdmin ? (
        <Section title="Compra al caficultor">
          <Field label="Kilos comprados" optional hint="Lo que entre a bodega será menor por secado y selección.">
            <Amount value={kg} onChange={setKg} unit="kg" placeholder="125" />
          </Field>
          <CostBlock
            title="Pago al caficultor"
            cost={cost}
            onChange={setCost}
            hint={num(kg) > 0 && costPayload(cost)
              ? `Equivale a $${Math.round(costPayload(cost)!.amount / num(kg)).toLocaleString('es-CO')} por kilo comprado (${formatKg(num(kg))}).`
              : undefined}
          />
        </Section>
      ) : null}

      <More summary="Perfil sensorial (opcional)">
        <Text style={f.hint}>Si prefiere, descríbalo al catar el tostado; la catación alimenta la etiqueta.</Text>
        <Field label="Aroma">
          <TextInput style={f.input} value={aroma} onChangeText={setAroma} placeholder="Chocolate, frutal, floral" />
        </Field>
        <Field label="Notas de sabor">
          <TextInput style={[f.input, { minHeight: 84, textAlignVertical: 'top' }]} multiline value={notes}
            onChangeText={setNotes} placeholder="Chocolate amargo, cereza, avellana" />
        </Field>
      </More>
    </StepScreen>
  );
}
