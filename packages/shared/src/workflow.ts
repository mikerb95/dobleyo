// Flujo guiado de producción: tipos de la bandeja "Qué sigue" y de la ficha
// del lote (GET /api/coffee/workflow/*), más el texto que ven los operarios.
//
// El servidor devuelve datos (tipo de tarea, kilos, días); las frases viven
// aquí para que la web y la app móvil digan exactamente lo mismo.

export type WorkflowUrgency = 'late' | 'now' | 'waiting' | 'anytime';

export type WorkflowTaskKind =
  | 'store_green'
  | 'send_roasting'
  | 'receive_roast'
  | 'store_roasted'
  | 'pack'
  | 'label'
  | 'cupping';

export type StationKey = 'harvest' | 'green' | 'roast' | 'roasted' | 'pack' | 'label';
export type StationState = 'done' | 'active' | 'next' | 'pending';

export interface LotBalance {
  greenKg: number;
  maquilaKg: number;
  roastedKg: number;
  packedKg: number;
  roastLossKg: number;
  dryingLossKg: number;
}

export interface LotHeader {
  lotId: string;
  farmName: string;
  variety: string | null;
  process: string | null;
  region: string | null;
  altitude: number | null;
  stations: Record<StationKey, StationState>;
  balance: LotBalance;
}

export interface WorkflowTask {
  id: string;
  kind: WorkflowTaskKind;
  lotId: string;
  urgency: WorkflowUrgency;
  since: string | null;
  ageDays: number | null;
  facts: {
    harvestKg?: number | null;
    availableKg?: number;
    sentKg?: number;
    expectedDays?: number;
    kg?: number;
    level?: string | null;
    location?: string | null;
    readyAt?: string;
    missing?: number;
  };
  ref: {
    lotId?: string;
    roastingId?: number;
    roastedId?: number;
    roastedStorageId?: number;
    packagedId?: number | null;
    quantity?: number;
  };
  lot?: LotHeader;
}

export interface WorkflowQueue {
  tasks: WorkflowTask[];
  lots: Array<LotHeader & { lastActivityAt: string | null; openTasks: number }>;
  counts: Record<WorkflowUrgency, number>;
  generatedAt: string;
}

export type LotEventKind =
  | 'harvest'
  | 'green_in'
  | 'sent_roasting'
  | 'roast_received'
  | 'roasted_in'
  | 'cupping'
  | 'packed'
  | 'labeled';

export interface LotEvent {
  kind: LotEventKind;
  at: string;
  data: Record<string, unknown>;
}

export interface LotJourney extends LotHeader {
  climate: string | null;
  aroma: string | null;
  tasteNotes: string | null;
  harvestedAt: string | null;
  harvestKg: number | null;
  events: LotEvent[];
  tasks: WorkflowTask[];
  strandedGreenKg: number;
  suggestedProfile: {
    acidity: number | null;
    body: number | null;
    balance: number | null;
    score: number | null;
    cuppedAt: string | null;
  } | null;
  labels: { total: number; printed: number; lastAt: string | null };
  traceUrl: string;
}

// ── Vocabulario ─────────────────────────────────────────────────────────────

export const VARIETY_LABELS: Record<string, string> = {
  CAT: 'Caturra', TIP: 'Típica', BOB: 'Bourbon', GER: 'Geisha', PAC: 'Pacamara',
};

export const PROCESS_LABELS: Record<string, string> = {
  NAT: 'Natural', HUM: 'Lavado', ANH: 'Anaeróbico',
};

export const CLIMATE_LABELS: Record<string, string> = {
  SECO: 'Seco', LLUV: 'Lluvioso', TEMP: 'Templado',
};

export const ROAST_LEVEL_LABELS: Record<string, string> = {
  LIGHT: 'claro', MEDIUM: 'medio', DARK: 'oscuro',
};

export const PACKAGE_SIZES = [
  { value: '250g', label: '250 g', kg: 0.25 },
  { value: '500g', label: '500 g', kg: 0.5 },
  { value: '1kg', label: '1 kg', kg: 1 },
  { value: '100g', label: '100 g', kg: 0.1 },
  { value: 'bulk', label: 'A granel', kg: 1 },
] as const;

export const GRIND_SIZES = [
  { value: 'EXTRA-FINE', label: 'Extra fina', hint: 'Espresso' },
  { value: 'FINE', label: 'Fina', hint: 'Aeropress, moka' },
  { value: 'MEDIUM-FINE', label: 'Media fina', hint: 'V60, Chemex' },
  { value: 'MEDIUM', label: 'Media', hint: 'Prensa francesa' },
  { value: 'COARSE', label: 'Gruesa', hint: 'Cafetera de goteo' },
] as const;

export const CONTAINERS = [
  { value: 'BAG-5KG', label: 'Bolsa de 5 kg', plural: 'bolsas de 5 kg', kg: 5 },
  { value: 'BAG-1KG', label: 'Bolsa de 1 kg', plural: 'bolsas de 1 kg', kg: 1 },
  { value: 'BUCKET-25', label: 'Cubeta de 25 kg', plural: 'cubetas de 25 kg', kg: 25 },
  { value: 'SACK-60', label: 'Saco de 60 kg', plural: 'sacos de 60 kg', kg: 60 },
] as const;

/** Códigos de región que usa el código de lote. */
export const REGION_LABELS: Record<string, string> = {
  HUI: 'Huila', NAR: 'Nariño', CAU: 'Cauca', ANT: 'Antioquia', TOL: 'Tolima',
  CAL: 'Caldas', RIS: 'Risaralda', QUI: 'Quindío', SAN: 'Santander', MAG: 'Magdalena',
};

export function regionLabel(code: string | null | undefined): string {
  return (code && REGION_LABELS[code]) || code || '';
}

/** "11 bolsas de 5 kg", "1 bolsa de 5 kg". */
export function containersLabel(count: number, type: string | null | undefined): string {
  const c = CONTAINERS.find((x) => x.value === type);
  if (!c) return `${count} ${type ?? (count === 1 ? 'contenedor' : 'contenedores')}`;
  return `${count} ${count === 1 ? c.label.toLowerCase() : c.plural}`;
}

export const ROAST_LEVELS = [
  { value: 'LIGHT', label: 'Claro' },
  { value: 'MEDIUM', label: 'Medio' },
  { value: 'DARK', label: 'Oscuro' },
] as const;

export const STORAGE_CONDITIONS = [
  { value: 'sealed', label: 'Sellado' },
  { value: 'cool', label: 'Lugar fresco' },
  { value: 'dark', label: 'Sin luz' },
] as const;

export const URGENCY_LABELS: Record<WorkflowUrgency, string> = {
  late: 'Atrasado',
  now: 'Para hoy',
  waiting: 'En espera',
  anytime: 'Cuando decida',
};

export const STATION_LABELS: Record<StationKey, string> = {
  harvest: 'Cosecha',
  green: 'Bodega verde',
  roast: 'Maquila',
  roasted: 'Bodega tostado',
  pack: 'Empaque',
  label: 'Etiqueta',
};

/** Merma de tueste habitual. Fuera de este rango vale la pena revisar. */
export const ROAST_LOSS_RANGE = { min: 12, max: 20 } as const;

// ── Formato ─────────────────────────────────────────────────────────────────

const kgFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function formatKg(kg: number | null | undefined): string {
  if (kg == null || !isFinite(Number(kg))) return 'sin dato';
  return `${kgFmt.format(Number(kg))} kg`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return '';
  return kgFmt.format(Number(n));
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "hoy", "ayer", "hace 3 días". */
export function daysAgo(days: number | null | undefined): string {
  if (days == null) return '';
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export function varietyLabel(code: string | null | undefined): string {
  return (code && VARIETY_LABELS[code]) || code || 'Variedad sin registrar';
}

export function processLabel(code: string | null | undefined): string {
  return (code && PROCESS_LABELS[code]) || code || '';
}

export function packageLabel(size: string | null | undefined): string {
  return PACKAGE_SIZES.find((p) => p.value === size)?.label ?? size ?? '';
}

/** Número de unidades con su sustantivo: "1 bolsa de 250 g", "3 kg a granel". */
export function unitsLabel(units: number, packageSize: string): string {
  if (packageSize === 'bulk') return `${formatKg(units)} a granel`;
  return `${units} ${units === 1 ? 'bolsa' : 'bolsas'} de ${packageLabel(packageSize)}`;
}

/** Fecha local de hoy en formato `YYYY-MM-DD` (para los campos de fecha). */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Frases de la bandeja ────────────────────────────────────────────────────

export interface TaskCopy {
  /** Objetivo de la tarea, en lenguaje de operario. */
  title: string;
  /** Contexto que justifica la urgencia. */
  detail: string;
  /** Verbo del botón. Se repite igual en el formulario y en la confirmación. */
  action: string;
}

export function describeTask(task: WorkflowTask): TaskCopy {
  const farm = task.lot?.farmName ?? 'este lote';
  const f = task.facts;
  const age = daysAgo(task.ageDays);

  switch (task.kind) {
    case 'store_green':
      return {
        title: `Guardar en bodega el café de ${farm}`,
        detail: task.urgency === 'late'
          ? `Se recibió ${age} y todavía no tiene ubicación.`
          : `Se recibió ${age}${f.harvestKg ? `, ${formatKg(f.harvestKg)} comprados` : ''}.`,
        action: 'Ingresar a bodega',
      };
    case 'send_roasting':
      return {
        title: `Enviar a la maquila el café de ${farm}`,
        detail: `${formatKg(f.availableKg)} de café verde disponibles en bodega.`,
        action: 'Preparar envío',
      };
    case 'receive_roast':
      if (task.urgency === 'waiting') {
        return {
          title: `El café de ${farm} está en la maquila`,
          detail: `Salieron ${formatKg(f.sentKg)} ${age}. Suele volver en ${f.expectedDays} días.`,
          action: 'Registrar recepción',
        };
      }
      return {
        title: `Recoger de la maquila el café de ${farm}`,
        detail: task.urgency === 'late'
          ? `Lleva ${task.ageDays} días fuera, más de lo habitual. Se enviaron ${formatKg(f.sentKg)}.`
          : `Lleva ${task.ageDays} días fuera. Se enviaron ${formatKg(f.sentKg)}.`,
        action: 'Registrar recepción',
      };
    case 'store_roasted':
      return {
        title: `Ubicar en bodega el tostado de ${farm}`,
        detail: `${formatKg(f.kg)} recibidos ${age} sin ubicación asignada.`,
        action: 'Asignar ubicación',
      };
    case 'pack': {
      if (task.urgency === 'waiting') {
        return {
          title: `El tostado de ${farm} está en reposo`,
          detail: `${formatKg(f.kg)} se pueden empacar desde el ${formatShortDate(f.readyAt)}.`,
          action: 'Empacar',
        };
      }
      const where = f.location ? ` en ${f.location}` : '';
      const tail = task.urgency === 'late'
        ? 'Está perdiendo frescura.'
        : task.urgency === 'now'
          ? 'Conviene empacarlo pronto.'
          : `Tostado ${age}.`;
      return {
        title: `Empacar el tostado de ${farm}`,
        detail: `${formatKg(f.kg)} listos${where}. ${tail}`,
        action: 'Empacar',
      };
    }
    case 'label':
      return {
        title: `Etiquetar las bolsas de ${farm}`,
        detail: f.missing === 1 ? 'Falta 1 etiqueta.' : `Faltan ${f.missing} etiquetas.`,
        action: 'Generar etiquetas',
      };
    case 'cupping':
      return {
        title: `Catar el tostado de ${farm}`,
        detail: 'El puntaje y el perfil de sabor pasan a la etiqueta.',
        action: 'Registrar catación',
      };
  }
}

/** Frase de resumen para el encabezado de la bandeja. */
export function describeQueue(queue: WorkflowQueue): string {
  const actionable = queue.tasks.filter((t) => t.urgency !== 'waiting');
  if (queue.tasks.length === 0) return 'No hay nada pendiente. Cuando registre una cosecha, aparecerá aquí.';
  if (actionable.length === 0) return 'Todo lo que depende de usted está al día. Solo queda esperar la maquila.';

  const count = actionable.length === 1 ? 'Hay 1 cosa por hacer' : `Hay ${actionable.length} cosas por hacer`;
  const first = actionable[0]!;
  if (first.urgency === 'late' || first.urgency === 'now') {
    const title = describeTask(first).title;
    return `${count}. Empiece por ${title.charAt(0).toLowerCase()}${title.slice(1)}.`;
  }
  return `${count}, ninguna urgente.`;
}

/** Saludo según la hora local. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── Frases de la historia del lote ──────────────────────────────────────────

export function describeEvent(event: LotEvent): { title: string; detail: string } {
  const d = event.data as Record<string, any>;
  switch (event.kind) {
    case 'harvest':
      return {
        title: `Cosecha en ${d.farm}`,
        detail: d.kg ? `${formatKg(d.kg)} comprados al caficultor.` : 'Lote creado.',
      };
    case 'green_in':
      return {
        title: 'Entró a bodega de café verde',
        detail: `${formatKg(d.kg)}${d.location ? ` en ${d.location}` : ''}.`,
      };
    case 'sent_roasting':
      return { title: 'Salió a la maquila', detail: `${formatKg(d.kg)} de café verde.` };
    case 'roast_received': {
      const parts = [formatKg(d.kg)];
      if (d.level) parts.push(`tueste ${ROAST_LEVEL_LABELS[d.level] ?? d.level}`);
      if (d.lossPct != null) parts.push(`merma del ${kgFmt.format(d.lossPct)} %`);
      if (d.days != null) parts.push(`${d.days} ${d.days === 1 ? 'día' : 'días'} en maquila`);
      return { title: 'Volvió tostado', detail: `${parts.join(', ')}.` };
    }
    case 'roasted_in': {
      const what = d.containers ? containersLabel(d.containers, d.containerType) : 'Ubicado';
      return {
        title: 'Guardado en bodega de tostado',
        detail: `${what}${d.location ? ` en ${d.location}` : ''}.`,
      };
    }
    case 'cupping':
      return {
        title: 'Catación',
        detail: `${d.score != null ? `${kgFmt.format(d.score)} puntos` : 'Sin puntaje'}${d.passed ? ', aprobada' : ''}.`,
      };
    case 'packed':
      return {
        title: 'Empacado',
        detail: `${unitsLabel(d.units, d.packageSize)}${
          d.packageSize !== 'bulk' ? `, ${d.presentation === 'MOLIDO' ? 'molido' : 'en grano'}` : ''
        }.`,
      };
    case 'labeled':
      return {
        title: 'Etiquetado',
        detail: `${d.total} ${d.total === 1 ? 'etiqueta' : 'etiquetas'}, ${d.printed} ${d.printed === 1 ? 'impresa' : 'impresas'}.`,
      };
  }
}
