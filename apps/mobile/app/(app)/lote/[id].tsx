import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  describeEvent, describeTask, formatKg, formatLongDate, formatShortDate, processLabel, regionLabel, varietyLabel,
} from '@dobleyo/shared';
import { useLot } from '../../../src/lib/workflow';
import { openTask } from '../../../src/lib/navigation';
import { Button, Note } from '../../../src/ui/form';
import { MassFlow, StationThread } from '../../../src/ui/route';
import { colors, fonts, spacing } from '../../../src/theme';

/** Ficha del lote: quién es, qué sigue, dónde está cada kilo y su historia. */
export default function LotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const lot = useLot(id);
  const data = lot.data;

  return (
    <>
      <Stack.Screen options={{ title: 'Lote' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={lot.isRefetching} onRefresh={() => void lot.refetch()} />}
      >
        {lot.isLoading ? <Text style={styles.muted}>Cargando el lote…</Text> : null}
        {lot.isError && !data ? (
          <Note>No se pudo abrir el lote. Si no tiene señal, ábralo de nuevo cuando la recupere.</Note>
        ) : null}

        {data ? (
          <>
            <View style={{ gap: 6 }}>
              <Text style={styles.code}>Lote {data.lotId}</Text>
              <Text style={styles.name} accessibilityRole="header">
                {varietyLabel(data.variety)} {processLabel(data.process).toLowerCase()} de {data.farmName}
              </Text>
              <Text style={styles.facts}>
                {[
                  regionLabel(data.region),
                  data.altitude ? `${data.altitude.toLocaleString('es-CO')} m de altura` : null,
                  data.harvestedAt ? `cosechado el ${formatLongDate(data.harvestedAt)}` : null,
                ].filter(Boolean).join(', ')}
              </Text>
              <StationThread stations={data.stations} large />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Lo que sigue</Text>
              {data.tasks.length === 0 ? <Text style={styles.muted}>Este lote no tiene pasos pendientes.</Text> : null}
              {data.tasks.map((t) => {
                const copy = describeTask({ ...t, lot: data });
                return (
                  <View key={t.id} style={styles.task}>
                    <Text style={styles.taskTitle}>{copy.title}</Text>
                    <Text style={styles.detail}>{copy.detail}</Text>
                    <View style={{ alignSelf: 'flex-start' }}>
                      <Button label={copy.action} variant={t.urgency === 'waiting' ? 'ghost' : 'primary'} onPress={() => openTask(router, t)} />
                    </View>
                  </View>
                );
              })}
              {data.strandedGreenKg > 0 ? (
                <Note>
                  Quedan {formatKg(data.strandedGreenKg)} de café verde en bodega. Por ahora un lote admite un solo envío a
                  la maquila, así que ese remanente no aparece como tarea.
                </Note>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Dónde está cada kilo</Text>
              <MassFlow balance={data.balance} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Historia del lote</Text>
              {data.events.map((e, i) => {
                const c = describeEvent(e);
                return (
                  <View key={`${e.kind}-${i}`} style={styles.event}>
                    <Text style={styles.eventDate}>{formatShortDate(e.at)}</Text>
                    <View style={styles.eventRail}>
                      <View style={styles.eventDot} />
                      {i < data.events.length - 1 ? <View style={styles.eventLine} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: spacing.md }}>
                      <Text style={styles.eventTitle}>{c.title}</Text>
                      <Text style={styles.detail}>{c.detail}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  code: { fontSize: 12.5, color: colors.muted },
  name: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.coffee },
  facts: { fontSize: 14, lineHeight: 20, color: colors.text },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.coffee },
  task: { gap: 6, padding: spacing.md, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  taskTitle: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25, color: colors.coffee },
  detail: { fontSize: 14, lineHeight: 20, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  event: { flexDirection: 'row', gap: spacing.sm },
  eventDate: { width: 56, fontSize: 12.5, color: colors.muted, textAlign: 'right', paddingTop: 1 },
  eventRail: { width: 12, alignItems: 'center' },
  eventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coffee, marginTop: 6 },
  eventLine: { flex: 1, width: 1, backgroundColor: colors.border, marginTop: 4 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: colors.coffee },
});
