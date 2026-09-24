import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import {
  CONTAINERS, ROAST_LEVELS, ROAST_LOSS_RANGE, STORAGE_CONDITIONS, formatKg, formatNumber, todayISO,
  type RoastRetrievalInput, type RoastedStorageInput, type StepResult,
} from '@dobleyo/shared';
import { mutationKeys } from '../lib/mutations';
import { costPayload, errorMessage, num, submitStep, useLocations, useStepMutation } from '../lib/workflow';
import {
  Amount, Chips, ChipsMulti, CostBlock, DateChips, Field, LocationPicker, More, Note, Section, TextArea, emptyCost,
} from '../ui/form';
import { StepScreen, stepStyles } from '../ui/StepScreen';
import { colors } from '../theme';
import { QUEUED_NOTE, type StepProps } from './types';

// El servidor rechaza un tostado por debajo del 60 % de lo enviado.
const MAX_LOSS = 40;

/**
 * El café vuelve de la maquila: se pesa, se registra el tueste y se guarda.
 * Son dos registros en el servidor; aquí es un solo momento. Con `roastedId`
 * (tostado ya recibido sin ubicación) solo se pide la ubicación.
 */
export default function ReceiveStep({ lot, role, onDone, onCancel, roastingId, roastedId: initialRoastedId }: StepProps & {
  roastingId?: number; roastedId?: number;
}) {
  const isAdmin = role === 'admin';
  const locations = useLocations('roasted');
  const receive = useStepMutation<RoastRetrievalInput, StepResult>(mutationKeys.roastRetrieval);
  const store = useStepMutation<RoastedStorageInput, StepResult>(mutationKeys.roastedStorage);

  const receiveTask = lot.tasks.find((t) => t.kind === 'receive_roast' && t.ref.roastingId === roastingId);
  const storeTask = lot.tasks.find((t) => t.kind === 'store_roasted' && t.ref.roastedId === initialRoastedId);
  const sentKg = receiveTask?.facts.sentKg ?? 0;

  const [roastedId, setRoastedId] = useState<number | null>(initialRoastedId ?? null);
  const [receivedKg, setReceivedKg] = useState<number>(storeTask?.facts.kg ?? 0);
  const [kg, setKg] = useState('');
  const [level, setLevel] = useState('');
  const [date, setDate] = useState(todayISO);
  const [temp, setTemp] = useState('');
  const [minutes, setMinutes] = useState('');
  const [observations, setObservations] = useState('');
  const [roastCost, setRoastCost] = useState(emptyCost);
  const [location, setLocation] = useState('');
  const [container, setContainer] = useState('BAG-5KG');
  const [count, setCount] = useState('');
  const [conditions, setConditions] = useState<string[]>(['sealed', 'cool', 'dark']);
  const [returnCost, setReturnCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onlyStore = roastedId != null;
  const weight = onlyStore ? receivedKg : num(kg);
  const loss = !onlyStore && sentKg > 0 && weight > 0 ? ((sentKg - weight) / sentKg) * 100 : null;
  const containerKg = CONTAINERS.find((c) => c.value === container)?.kg ?? 1;
  const suggested = weight > 0 ? Math.ceil(weight / containerKg) : null;

  if (!onlyStore && !receiveTask) {
    return (
      <StepScreen title="Este paso ya no está pendiente" submitLabel="Volver" onSubmit={onCancel} onCancel={onCancel}>
        <Note>Este envío ya fue recibido o no está en la maquila. Revise la historia del lote.</Note>
      </StepScreen>
    );
  }

  async function submit() {
    setError(null);
    if (!onlyStore) {
      if (!(weight > 0)) return setError('Escriba cuántos kilos volvieron tostados.');
      if (weight >= sentKg) return setError(`El tostado pesa menos que lo enviado (${formatKg(sentKg)}): siempre hay merma.`);
      if (loss! > MAX_LOSS) return setError(`Una merma del ${formatNumber(loss)} % es demasiado alta. Revise el peso.`);
      if (!level) return setError('Elija el nivel de tueste.');
    }
    const offline = !onlineManager.isOnline();
    const n = parseInt(count || String(suggested ?? ''), 10);
    if (!offline) {
      if (!location) return setError('Elija dónde queda guardado el tostado.');
      if (!(n > 0)) return setError('Indique cuántos contenedores quedan en la ubicación.');
    }

    setBusy(true);
    let currentId = roastedId;
    try {
      if (!onlyStore) {
        const out = await submitStep(receive, {
          roastingId: roastingId!,
          roastLevel: level as RoastRetrievalInput['roastLevel'],
          roastedWeight: weight,
          actualTemp: temp ? num(temp) : undefined,
          roastTime: minutes ? num(minutes) : undefined,
          observations: observations.trim() || undefined,
          recordedAt: date,
          ...(isAdmin ? { cost: costPayload(roastCost) } : {}),
        });
        // Sin señal no hay id del tostado: la ubicación se asigna después,
        // cuando la tarea "Ubicar en bodega" aparezca en Qué sigue.
        if (out.queued) {
          return onDone({
            lotId: lot.lotId,
            title: 'Recepción guardada',
            detail: `Volvieron ${formatKg(weight)}. ${QUEUED_NOTE} La ubicación en bodega se asigna cuando llegue al servidor.`,
            queued: true,
          });
        }
        currentId = out.result.roastedId ?? null;
        setRoastedId(currentId);
        setReceivedKg(weight);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    try {
      const out = await submitStep(store, {
        roastedId: currentId!, location, container, containerCount: n, conditions, recordedAt: date,
        ...(isAdmin ? { cost: costPayload(returnCost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: onlyStore ? 'Tostado ubicado en bodega' : 'Tostado recibido y guardado',
        detail: (onlyStore
          ? `${formatKg(weight)} en ${location}.`
          : `Volvieron ${formatKg(weight)} (merma del ${formatNumber(loss)} %) y quedaron en ${location}.`)
          + (out.queued ? ` ${QUEUED_NOTE}` : ''),
        queued: out.queued,
      });
    } catch (err) {
      setError(onlyStore ? errorMessage(err) : `El tostado quedó registrado, pero no se pudo guardar la ubicación: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  const verdict = loss == null ? null
    : loss < ROAST_LOSS_RANGE.min ? 'Merma baja: confirme el peso.'
    : loss <= ROAST_LOSS_RANGE.max ? 'Dentro de lo normal.'
    : loss <= MAX_LOSS ? 'Merma alta: conviene revisarla con la maquila.'
    : 'No es posible: revise el peso.';

  return (
    <StepScreen
      lot={`Lote ${lot.lotId}`}
      title={onlyStore ? `Ubicar en bodega el tostado de ${lot.farmName}` : `Recibir el tostado de ${lot.farmName}`}
      intro={onlyStore
        ? `${formatKg(weight)} ya recibidos esperan un lugar en la bodega de tostado.`
        : `Salieron ${formatKg(sentKg)} de café verde ${receiveTask!.ageDays ? `hace ${receiveTask!.ageDays} días` : 'hoy'}. Pese lo que volvió y guárdelo.`}
      consequence={loss != null
        ? <>Merma del <Text style={stepStyles.strong}>{formatNumber(loss)} %</Text>. {verdict}</>
        : onlyStore && location ? <>Quedarán <Text style={stepStyles.strong}>{formatKg(weight)}</Text> en {location}.</> : null}
      error={error}
      submitLabel={onlyStore ? 'Asignar ubicación' : 'Registrar recepción'}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      {!onlyStore ? (
        <Section title="Lo que volvió">
          <Field label="Peso tostado">
            <Amount value={kg} onChange={setKg} unit="kg" placeholder={sentKg ? String(Math.round(sentKg * 8.4) / 10) : '84'} />
          </Field>
          {loss != null ? <LossGauge loss={loss} /> : null}
          <Chips label="Nivel de tueste" options={ROAST_LEVELS} value={level} onChange={setLevel} />
          <DateChips label="Fecha de recepción" value={date} onChange={setDate} />
          {isAdmin ? <CostBlock title="Valor de la maquila" cost={roastCost} onChange={setRoastCost} /> : null}
          <More summary="Datos del perfil de tueste (opcional)">
            <Field label="Temperatura final"><Amount value={temp} onChange={setTemp} unit="°C" decimals={false} placeholder="205" /></Field>
            <Field label="Tiempo de tueste"><Amount value={minutes} onChange={setMinutes} unit="min" decimals={false} placeholder="12" /></Field>
            <Field label="Observaciones"><TextArea value={observations} onChange={setObservations} placeholder="Color, aroma, desarrollo" /></Field>
          </More>
        </Section>
      ) : null}

      <Section title="Dónde queda">
        <LocationPicker label="Ubicación en bodega de tostado" locations={locations.data} loading={locations.isLoading}
          error={locations.error} value={location} onChange={setLocation} neededKg={weight} />
        <Chips label="Contenedor" options={CONTAINERS} value={container} onChange={setContainer} />
        <Field label="Cuántos contenedores" hint={suggested ? `Para ${formatKg(weight)} se necesitan ${suggested}.` : undefined}>
          <Amount value={count} onChange={setCount} decimals={false} placeholder={suggested ? String(suggested) : '4'} />
        </Field>
        <ChipsMulti label="Condiciones" options={STORAGE_CONDITIONS} value={conditions} onChange={setConditions} />
        {isAdmin ? <CostBlock title="Transporte de regreso a bodega" cost={returnCost} onChange={setReturnCost} /> : null}
      </Section>
    </StepScreen>
  );
}

/** Regla de 0 a 40 % con la franja habitual y la merma de este tueste. */
function LossGauge({ loss }: { loss: number }) {
  const pct = (x: number) => Math.min(100, Math.max(0, (x / MAX_LOSS) * 100));
  const tone = loss >= ROAST_LOSS_RANGE.min && loss <= ROAST_LOSS_RANGE.max ? colors.coffee : loss > MAX_LOSS ? colors.danger : colors.accent;
  return (
    <View style={g.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={g.track}>
        <View style={[g.band, { left: `${pct(ROAST_LOSS_RANGE.min)}%`, width: `${pct(ROAST_LOSS_RANGE.max) - pct(ROAST_LOSS_RANGE.min)}%` }]} />
        <View style={[g.mark, { left: `${pct(loss)}%`, backgroundColor: tone }]} />
      </View>
      <View style={g.scale}>
        <Text style={g.tick}>0 %</Text>
        <Text style={g.tick}>{ROAST_LOSS_RANGE.min} a {ROAST_LOSS_RANGE.max} % es lo normal</Text>
        <Text style={g.tick}>{MAX_LOSS} %</Text>
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: colors.wfGreen },
  mark: { position: 'absolute', top: -4, width: 4, height: 16, marginLeft: -2, borderRadius: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { fontSize: 11, color: colors.muted },
});
