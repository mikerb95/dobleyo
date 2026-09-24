import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeTask, type WorkflowTask } from '@dobleyo/shared';
import { API_BASE_URL } from '../config';
import { useLot } from '../lib/workflow';
import { Button } from '../ui/form';
import { colors, fonts, spacing } from '../theme';
import type { StepDone } from './types';

/**
 * Cierre de un paso: qué se guardó y qué sigue con el mismo lote. Como casi
 * siempre es la misma persona, se ofrece el siguiente paso en vez de volver
 * a la lista.
 */
export default function DoneView({ done, onNext, onOpenLot, onHome }: {
  done: StepDone;
  onNext: (task: WorkflowTask) => void;
  onOpenLot: (lotId: string) => void;
  onHome: () => void;
}) {
  const insets = useSafeAreaInsets();
  const lot = useLot(done.queued ? undefined : done.lotId);
  const tasks = lot.data?.tasks ?? [];
  const ready = tasks.filter((t) => t.urgency !== 'waiting');
  const waiting = tasks.filter((t) => t.urgency === 'waiting');
  const [next, ...others] = ready;
  const copy = (t: WorkflowTask) => describeTask({ ...t, lot: lot.data });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.mark, done.queued && styles.markQueued]}>
          <Text style={[styles.markText, done.queued && { color: colors.accent }]}>{done.queued ? '↻' : '✓'}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">{done.title}</Text>
        <Text style={styles.detail}>{done.detail}</Text>

        {done.printLabels && done.lotId ? (
          <View style={styles.print}>
            <Text style={styles.small}>Las etiquetas quedan listas en el panel web para imprimirlas desde el computador.</Text>
            <Button variant="ghost" label="Abrir para imprimir"
              onPress={() => void Linking.openURL(`${API_BASE_URL}/admin/etiquetas?imprimir=${encodeURIComponent(done.lotId!)}`)} />
          </View>
        ) : null}

        {!done.queued && done.lotId ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.nextHead}>Lo que sigue con este lote</Text>
            {lot.isLoading ? <Text style={styles.small}>Consultando…</Text> : next ? (
              <View style={styles.nextCard}>
                <Text style={styles.nextTitle}>{copy(next).title}</Text>
                <Text style={styles.small}>{copy(next).detail}</Text>
                <Button label={copy(next).action} onPress={() => onNext(next)} />
              </View>
            ) : (
              <Text style={styles.small}>{waiting.length ? copy(waiting[0]!).detail : 'Este lote no tiene más pasos por ahora.'}</Text>
            )}
            {next ? waiting.map((t) => <Text key={t.id} style={styles.small}>{copy(t).detail}</Text>) : null}
            {others.map((t) => (
              <Text key={t.id} style={styles.link} onPress={() => onNext(t)} accessibilityRole="link">{copy(t).title}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: spacing.md + insets.bottom }]}>
        {done.lotId && !done.queued ? (
          <View style={{ flex: 1 }}><Button variant="ghost" label="Ver el lote" onPress={() => onOpenLot(done.lotId!)} /></View>
        ) : null}
        <View style={{ flex: 1 }}><Button variant={next ? 'ghost' : 'primary'} label="Qué sigue" onPress={onHome} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.md, paddingTop: spacing.xl },
  mark: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.success, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  markQueued: { borderColor: colors.accent, backgroundColor: colors.tint },
  markText: { fontSize: 24, color: colors.success, fontWeight: '700' },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.coffee },
  detail: { fontSize: 16, lineHeight: 24, color: colors.text },
  print: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  nextHead: { marginTop: spacing.md, fontSize: 16, fontWeight: '700', color: colors.coffee },
  nextCard: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.tint },
  nextTitle: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, color: colors.coffee },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  link: { fontSize: 15, color: colors.coffee, textDecorationLine: 'underline', paddingVertical: 6 },
  foot: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
});
