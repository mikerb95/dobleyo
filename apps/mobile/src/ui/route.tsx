// "La ruta del grano" en nativo: hilo de estaciones y barra de masa del lote.
// Espejo de src/components/workflow/Route.jsx en la web.

import { StyleSheet, Text, View } from 'react-native';
import { STATION_LABELS, formatKg, type LotBalance, type StationKey, type StationState, type WorkflowTaskKind } from '@dobleyo/shared';
import { colors, spacing } from '../theme';

const STATIONS: StationKey[] = ['harvest', 'green', 'roast', 'roasted', 'pack', 'label'];

export const TASK_STATION: Record<WorkflowTaskKind, StationKey> = {
  store_green: 'green',
  send_roasting: 'roast',
  receive_roast: 'roast',
  store_roasted: 'roasted',
  pack: 'pack',
  label: 'label',
  cupping: 'roasted',
};

const STATE_TEXT: Record<StationState, string> = { done: 'completa', active: 'en curso', next: 'sigue', pending: 'pendiente' };

export function StationThread({ stations, focus, large }: {
  stations?: Record<StationKey, StationState>; focus?: StationKey; large?: boolean;
}) {
  if (!stations) return null;
  const label = STATIONS.map((k) => `${STATION_LABELS[k]}: ${STATE_TEXT[stations[k]]}`).join('. ');
  const size = large ? 12 : 9;
  return (
    <View style={[styles.thread, large && styles.threadLarge]} accessible accessibilityLabel={`Recorrido del lote. ${label}`}>
      {STATIONS.map((k, i) => {
        const st = stations[k];
        const fill = st === 'done' ? colors.coffee : st === 'active' ? colors.accent : colors.card;
        const border = st === 'done' ? colors.coffee : st === 'active' || st === 'next' ? colors.accent : colors.border;
        return (
          <View key={k} style={[styles.station, large && { flex: 1 }]}>
            <View style={styles.beadRow}>
              {i > 0 ? <View style={[styles.link, large && { flex: 1 }]} /> : large ? <View style={{ flex: 1 }} /> : null}
              <View
                style={[
                  { width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, backgroundColor: fill, borderColor: border },
                  st === 'next' && { borderStyle: 'dashed' },
                  focus === k && styles.focus,
                ]}
              />
              {large ? (i < STATIONS.length - 1 ? <View style={[styles.link, { flex: 1 }]} /> : <View style={{ flex: 1 }} />) : null}
            </View>
            {large ? (
              <Text style={[styles.stationLabel, (st === 'active' || st === 'next') && styles.stationLabelOn]} numberOfLines={2}>
                {STATION_LABELS[k]}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const FLOW: Array<{ key: keyof LotBalance | 'lossKg'; label: string; color: string; hatched?: boolean }> = [
  { key: 'greenKg', label: 'Verde en bodega', color: colors.wfGreen },
  { key: 'maquilaKg', label: 'En maquila', color: colors.wfMaquila },
  { key: 'roastedKg', label: 'Tostado en bodega', color: colors.wfRoasted },
  { key: 'packedKg', label: 'Empacado', color: colors.wfPacked },
  { key: 'lossKg', label: 'Merma', color: colors.wfLoss, hatched: true },
];

/** El lote como un solo cuerpo repartido entre estados; la merma al final. */
export function MassFlow({ balance, compact }: { balance?: LotBalance; compact?: boolean }) {
  if (!balance) return null;
  const values: Record<string, number> = { ...balance, lossKg: (balance.roastLossKg || 0) + (balance.dryingLossKg || 0) };
  const parts = FLOW.filter((f) => values[f.key] > 0);
  if (!parts.length) {
    return compact ? null : <Text style={styles.empty}>Todavía no hay kilos registrados en bodega.</Text>;
  }
  const label = parts.map((f) => `${f.label}: ${formatKg(values[f.key])}`).join(', ');
  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.bar, compact && styles.barCompact]} accessible accessibilityLabel={label}>
        {parts.map((f) => (
          <View key={f.key} style={{ flex: values[f.key], backgroundColor: f.color, opacity: f.hatched ? 0.9 : 1 }} />
        ))}
      </View>
      {!compact
        ? parts.map((f) => (
            <View key={f.key} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: f.color }]} />
              <Text style={styles.legendName}>{f.label}</Text>
              <Text style={styles.legendKg}>{formatKg(values[f.key])}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { flexDirection: 'row', alignItems: 'center' },
  threadLarge: { alignItems: 'flex-start', marginTop: spacing.md },
  station: { alignItems: 'center' },
  beadRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  link: { width: 10, height: 1, backgroundColor: colors.border, marginHorizontal: 2 },
  focus: { shadowColor: colors.accent, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, borderWidth: 3, borderColor: colors.accent },
  stationLabel: { marginTop: 6, fontSize: 11, color: colors.muted, textAlign: 'center' },
  stationLabelOn: { color: colors.coffee, fontWeight: '700' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, backgroundColor: colors.border },
  barCompact: { height: 6, borderRadius: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendName: { flex: 1, fontSize: 14, color: colors.text },
  legendKg: { fontSize: 14, fontWeight: '700', color: colors.coffee },
  empty: { fontSize: 14, color: colors.muted },
});
