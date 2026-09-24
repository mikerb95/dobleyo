import { useState } from 'react';
import { Text } from 'react-native';
import { formatKg, todayISO, type SendRoastingInput, type StepResult } from '@dobleyo/shared';
import { mutationKeys } from '../lib/mutations';
import { costPayload, errorMessage, num, submitStep, useStepMutation } from '../lib/workflow';
import { Amount, CostBlock, DateChips, Field, More, Note, Section, TextArea, emptyCost } from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import { QUEUED_NOTE, type StepProps } from './types';

/** El café verde sale hacia la maquila. */
export default function SendStep({ lot, role, onDone, onCancel }: StepProps) {
  const isAdmin = role === 'admin';
  const available = lot.balance.greenKg;
  const mutation = useStepMutation<SendRoastingInput, StepResult>(mutationKeys.sendRoasting);
  const [kg, setKg] = useState(available ? String(available) : '');
  const [date, setDate] = useState(todayISO);
  const [temp, setTemp] = useState('');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = num(kg);
  const left = Math.max(0, Math.round((available - (qty || 0)) * 1000) / 1000);

  let consequence = null;
  if (qty > available) consequence = <>Solo hay {formatKg(available)} en bodega.</>;
  else if (qty > 0) consequence = left > 0
    ? <>Salen <Text style={stepStyles.strong}>{formatKg(qty)}</Text> y quedan {formatKg(left)} en bodega.</>
    : <>Sale <Text style={stepStyles.strong}>todo el café verde</Text> del lote ({formatKg(qty)}).</>;

  async function submit() {
    if (!(qty > 0)) return setError('Escriba cuántos kilos salen a la maquila.');
    if (qty > available) return setError(`No puede enviar más de lo que hay en bodega (${formatKg(available)}).`);
    const t = num(temp);
    if (temp && !(t >= 180 && t <= 230)) return setError('La temperatura objetivo debe estar entre 180 y 230 °C.');
    setError(null);
    setBusy(true);
    try {
      const out = await submitStep(mutation, {
        lotId: lot.lotId, quantitySent: qty, targetTemp: temp ? t : undefined,
        notes: notes.trim() || undefined, recordedAt: date,
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: 'Café enviado a la maquila',
        detail: out.queued
          ? `Salieron ${formatKg(qty)}. ${QUEUED_NOTE}`
          : `Salieron ${formatKg(qty)} de ${lot.farmName}. Cuando vuelva tostado, regístrelo desde Qué sigue.`,
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
      title={`Enviar a la maquila el café de ${lot.farmName}`}
      intro={`Hay ${formatKg(available)} de café verde en bodega.`}
      consequence={consequence}
      error={error}
      submitLabel="Enviar a la maquila"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Qué sale">
        <Field label="Kilos que salen">
          <Amount value={kg} onChange={setKg} unit="kg"
            action={qty !== available ? { label: 'Todo', onPress: () => setKg(String(available)) } : null} />
        </Field>
        {qty > 0 && qty < available ? (
          <Note>
            Por ahora cada lote admite un solo envío a la maquila: los {formatKg(left)} que queden no se podrán enviar
            después con este mismo código. Si quiere tostarlo todo, envíelo completo.
          </Note>
        ) : null}
        <DateChips label="Fecha de salida" value={date} onChange={setDate} />
      </Section>
      {isAdmin ? <CostBlock title="Transporte hasta la tostadora" cost={cost} onChange={setCost} /> : null}
      <More summary="Indicaciones para la maquila (opcional)">
        <Field label="Temperatura objetivo" hint="Entre 180 y 230 °C.">
          <Amount value={temp} onChange={setTemp} unit="°C" decimals={false} placeholder="210" />
        </Field>
        <Field label="Nota para el tostador">
          <TextArea value={notes} onChange={setNotes} placeholder="Perfil deseado, fecha en que se necesita" />
        </Field>
      </More>
    </StepScreen>
  );
}
