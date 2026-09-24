// Piezas de formulario del flujo guiado. Grandes y táctiles: se usan de pie,
// en bodega o en la mesa de empaque, muchas veces con una sola mano.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StorageLocation } from '@dobleyo/shared';
import { formatNumber, todayISO } from '@dobleyo/shared';
import { colors, fonts, radius, spacing } from '../theme';

export function Button({
  label, onPress, variant = 'primary', disabled, busy,
}: { label: string; onPress: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean; busy?: boolean }) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.btnPrimary : styles.btnGhost,
        (pressed || disabled || busy) && { opacity: 0.6 },
      ]}
    >
      <Text style={primary ? styles.btnPrimaryText : styles.btnGhostText}>{busy ? 'Guardando…' : label}</Text>
    </Pressable>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {aside ? <Text style={styles.muted}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Field({ label, hint, optional, children }: { label?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <View style={styles.field}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}>  opcional</Text> : null}
        </Text>
      ) : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export type Option = { value: string; label: string; hint?: string };

export function Chips({ label, options, value, onChange }: { label?: string; options: ReadonlyArray<Option>; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
              {o.hint ? <Text style={[styles.chipHint, on && styles.chipTextOn]}>{o.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export function ChipsMulti({ label, options, value, onChange }: { label?: string; options: ReadonlyArray<Option>; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Field label={label} optional>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(o.value)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/** Número con unidad, en grande: se lee como una báscula. */
export function Amount({
  value, onChange, unit, placeholder, decimals = true, action, accessibilityLabel,
}: {
  value: string; onChange: (v: string) => void; unit?: string; placeholder?: string;
  decimals?: boolean; action?: { label: string; onPress: () => void } | null; accessibilityLabel?: string;
}) {
  return (
    <View style={styles.amount}>
      <TextInput
        style={styles.amountInput}
        value={value}
        onChangeText={onChange}
        keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={accessibilityLabel}
      />
      {unit ? <Text style={styles.amountUnit}>{unit}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={styles.inlineBtn} hitSlop={8}>
          <Text style={styles.inlineBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <TextInput
      style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      multiline
    />
  );
}

function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha sin selector nativo: hoy, ayer u otra escrita a mano. */
export function DateChips({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const today = todayISO();
  const yesterday = shiftDays(today, -1);
  const mode = value === today ? 'today' : value === yesterday ? 'yesterday' : 'other';
  const [draft, setDraft] = useState(mode === 'other' ? value : '');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft <= today;

  return (
    <Field label={label} hint={mode === 'other' ? 'Escriba la fecha como AAAA-MM-DD.' : undefined}>
      <View style={styles.chips}>
        {[
          { key: 'today', label: 'Hoy', onPress: () => onChange(today) },
          { key: 'yesterday', label: 'Ayer', onPress: () => onChange(yesterday) },
          { key: 'other', label: 'Otra fecha', onPress: () => { setDraft(shiftDays(today, -2)); onChange(shiftDays(today, -2)); } },
        ].map((c) => (
          <Pressable key={c.key} accessibilityRole="radio" accessibilityState={{ checked: mode === c.key }}
            onPress={c.onPress} style={[styles.chip, mode === c.key && styles.chipOn]}>
            <Text style={[styles.chipText, mode === c.key && styles.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'other' ? (
        <TextInput
          style={[styles.input, !valid && draft ? { borderColor: colors.danger } : null]}
          value={draft}
          onChangeText={(t) => { setDraft(t); if (/^\d{4}-\d{2}-\d{2}$/.test(t) && t <= today) onChange(t); }}
          placeholder="2026-09-20"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      ) : null}
    </Field>
  );
}

/** Estantes de la bodega con su ocupación; los que no alcanzan se atenúan. */
export function LocationPicker({
  label, locations, loading, error, value, onChange, neededKg,
}: {
  label: string; locations?: StorageLocation[]; loading: boolean; error: unknown;
  value: string; onChange: (code: string) => void; neededKg: number;
}) {
  if (loading) return <Field label={label}><Text style={styles.hint}>Cargando ubicaciones…</Text></Field>;
  if (error) return <Field label={label}><Text style={styles.error}>No se pudieron cargar las ubicaciones. Revise la señal.</Text></Field>;
  if (!locations?.length) {
    return <Field label={label}><Text style={styles.error}>No hay ubicaciones configuradas. Créelas en el panel web, en Ubicaciones.</Text></Field>;
  }
  return (
    <Field label={label}>
      <View style={styles.places}>
        {locations.map((l) => {
          const free = l.capacity_kg != null ? Math.max(0, l.capacity_kg - l.occupied_kg) : null;
          const tooSmall = free != null && neededKg > 0 && neededKg > free;
          const on = value === l.code;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: tooSmall }}
              disabled={tooSmall}
              onPress={() => onChange(l.code)}
              style={[styles.place, on && styles.placeOn, tooSmall && { opacity: 0.45 }]}
            >
              <Text style={styles.placeName}>{l.name}</Text>
              <Text style={styles.muted}>{l.code}</Text>
              {l.capacity_kg != null ? (
                <>
                  <View style={styles.fill}><View style={[styles.fillBar, { width: `${Math.min(100, l.fill_pct ?? 0)}%` }]} /></View>
                  <Text style={styles.muted}>{tooSmall ? 'No alcanza' : `${formatNumber(free)} kg libres`}</Text>
                </>
              ) : (
                <Text style={styles.muted}>Sin límite de capacidad</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/** Escala 1 a 5 con puntos para el perfil de la etiqueta. */
export function DotScale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (n: number) => void; low: string; high: string }) {
  return (
    <View style={styles.dotScale}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: value }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${label}: ${n} de 5`}>
            <View style={[styles.dot, n <= value && styles.dotOn]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.dotEnds}><Text style={styles.small}>{low}</Text><Text style={styles.small}>{high}</Text></View>
    </View>
  );
}

export type CostState = { amount: string; method: 'caja' | 'banco' | 'credito' };
export const emptyCost = (): CostState => ({ amount: '', method: 'caja' });

const PAYMENT: ReadonlyArray<{ value: CostState['method']; label: string }> = [
  { value: 'caja', label: 'Efectivo' },
  { value: 'banco', label: 'Banco' },
  { value: 'credito', label: 'A crédito' },
];

/** Costo del paso. Solo el admin lo ve; el servidor descarta montos de otros roles. */
export function CostBlock({ title, cost, onChange, hint }: { title: string; cost: CostState; onChange: (c: CostState) => void; hint?: string }) {
  const digits = cost.amount.replace(/[^\d]/g, '');
  return (
    <View style={styles.cost}>
      <View style={styles.costHead}>
        <View style={styles.costDot} />
        <Text style={styles.label}>{title}</Text>
        <Text style={[styles.optional, { marginLeft: 'auto' }]}>opcional</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Amount
        value={digits ? Number(digits).toLocaleString('es-CO') : ''}
        onChange={(t) => onChange({ ...cost, amount: t })}
        unit="COP"
        decimals={false}
        placeholder="Ej: 250.000"
        accessibilityLabel={`${title}, valor en pesos`}
      />
      <View style={styles.chips}>
        {PAYMENT.map((p) => (
          <Pressable key={p.value} onPress={() => onChange({ ...cost, method: p.value })}
            style={[styles.chip, cost.method === p.value && styles.chipOn]}>
            <Text style={[styles.chipText, cost.method === p.value && styles.chipTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Casilla con texto. */
export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.check}>
      <View style={[styles.box, value && styles.boxOn]}>{value ? <Text style={styles.boxMark}>✓</Text> : null}</View>
      <Text style={styles.checkText}>{label}</Text>
    </Pressable>
  );
}

/** Contenido opcional plegado para no distraer del objetivo del paso. */
export function More({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.more}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.moreHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.moreSign}><Text style={styles.moreSignText}>{open ? '−' : '+'}</Text></View>
        <Text style={styles.moreText}>{summary}</Text>
      </Pressable>
      {open ? <View style={{ gap: spacing.md, paddingTop: spacing.md }}>{children}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  btnPrimary: { backgroundColor: colors.coffee },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  btnPrimaryText: { color: colors.cream, fontSize: 16, fontWeight: '600' },
  btnGhostText: { color: colors.coffee, fontSize: 16, fontWeight: '600' },

  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.coffee },

  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  optional: { fontSize: 12, fontWeight: '400', color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.muted },
  small: { fontSize: 11, color: colors.muted },
  note: { backgroundColor: colors.tint, borderRadius: radius.md, padding: spacing.md, fontSize: 14, lineHeight: 20, color: colors.text },

  input: {
    minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.text, backgroundColor: colors.card,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 46, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.coffee, borderColor: colors.coffee },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipHint: { fontSize: 12, color: colors.muted },
  chipTextOn: { color: colors.cream },

  amount: {
    flexDirection: 'row', alignItems: 'center', minHeight: 58, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingLeft: spacing.md, paddingRight: spacing.sm, backgroundColor: colors.card, gap: spacing.sm,
  },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '600', color: colors.coffee, paddingVertical: 8 },
  amountUnit: { fontSize: 15, color: colors.muted },
  inlineBtn: { backgroundColor: colors.tint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  inlineBtnText: { fontSize: 13, fontWeight: '700', color: colors.coffee },

  places: { gap: spacing.sm },
  place: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, gap: 4, backgroundColor: colors.card },
  placeOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  placeName: { fontSize: 15, fontWeight: '700', color: colors.coffee },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginTop: 4 },
  fillBar: { height: 4, backgroundColor: colors.wfRoasted },

  dotScale: { gap: 8, flex: 1, minWidth: 140 },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  dotOn: { backgroundColor: colors.coffee, borderColor: colors.coffee },
  dotEnds: { flexDirection: 'row', justifyContent: 'space-between', maxWidth: 170 },

  cost: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.costBg, borderWidth: 1, borderColor: colors.costBorder },
  costHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  costDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },

  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.coffee, borderColor: colors.coffee },
  boxMark: { color: colors.cream, fontSize: 15, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 15, color: colors.text },

  more: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  moreHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  moreSign: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  moreSignText: { fontSize: 15, color: colors.coffee, lineHeight: 18 },
  moreText: { fontSize: 15, fontWeight: '600', color: colors.coffee },

  serifTitle: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.coffee },
});
