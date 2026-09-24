import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import {
  URGENCY_LABELS, describeQueue, describeTask, greeting, processLabel, varietyLabel,
  type WorkflowTask, type WorkflowUrgency,
} from '@dobleyo/shared';
import { useAuth } from '../../src/auth/AuthContext';
import { api } from '../../src/lib/api';
import { queryKeys } from '../../src/lib/mutations';
import { useQueue } from '../../src/lib/workflow';
import { openTask } from '../../src/lib/navigation';
import { Button } from '../../src/ui/form';
import { MassFlow, StationThread, TASK_STATION } from '../../src/ui/route';
import { colors, fonts, radius, spacing } from '../../src/theme';

const GROUPS: WorkflowUrgency[] = ['late', 'now', 'waiting', 'anytime'];
const GROUP_HINT: Record<WorkflowUrgency, string> = {
  late: 'Llevan más tiempo del normal.',
  now: 'Conviene hacerlas hoy.',
  waiting: 'Dependen de otros; se registran cuando ocurran.',
  anytime: 'Pueden esperar a que usted decida.',
};
const DOT: Record<WorkflowUrgency, string> = { late: colors.late, now: colors.now, waiting: colors.waiting, anytime: colors.anytime };

/** "Qué sigue": el trabajo pendiente de la línea, redactado como objetivos. */
export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const queue = useQueue();
  // Registros guardados sin señal que aún no llegan al servidor.
  const pendingSync = useMutationState({ filters: { status: 'pending' } }).length;

  // Con señal, se guardan las fichas de los lotes con tareas: así los pasos
  // se pueden abrir y registrar después en bodega o en finca, sin cobertura.
  useEffect(() => {
    const ids = [...new Set((queue.data?.tasks ?? []).map((t) => t.lotId))].slice(0, 25);
    ids.forEach((id) => void qc.prefetchQuery({ queryKey: queryKeys.lot(id), queryFn: () => api.workflow.getLot(id) }));
  }, [queue.data, qc]);

  const data = queue.data;
  const tasks = data?.tasks ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Qué sigue',
          headerRight: () => (
            <Pressable onPress={() => void logout()} hitSlop={12}>
              <Text style={styles.logout}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={queue.isRefetching} onRefresh={() => void queue.refetch()} />}
      >
        <Text style={styles.hello} accessibilityRole="header">
          {greeting()}{user?.first_name ? `, ${user.first_name}` : ''}.
        </Text>
        <Text style={styles.summary}>
          {data ? describeQueue(data) : queue.isError ? 'No se pudo cargar el trabajo pendiente. Deslice hacia abajo para reintentar.' : 'Revisando la línea de producción…'}
        </Text>

        {pendingSync > 0 ? (
          <View style={styles.sync}>
            <Text style={styles.syncText}>
              {pendingSync === 1 ? '1 registro guardado en el teléfono' : `${pendingSync} registros guardados en el teléfono`}, se envían al recuperar la señal.
            </Text>
          </View>
        ) : null}

        <Button label="Registrar cosecha" onPress={() => router.push('/(app)/paso/harvest' as never)} />

        {GROUPS.map((g) => {
          const list = tasks.filter((t) => t.urgency === g);
          if (!list.length) return null;
          return (
            <View key={g} style={{ gap: spacing.sm }}>
              <View style={styles.groupHead}>
                <View style={[styles.dot, { backgroundColor: DOT[g] }]} />
                <Text style={styles.groupTitle} accessibilityRole="header">{URGENCY_LABELS[g]}</Text>
                <Text style={styles.count}>{list.length}</Text>
              </View>
              <Text style={styles.groupHint}>{GROUP_HINT[g]}</Text>
              <View style={styles.tasks}>
                {list.map((t, i) => (
                  <TaskRow key={t.id} task={t} first={i === 0}
                    onOpenLot={() => router.push(`/(app)/lote/${encodeURIComponent(t.lotId)}` as never)}
                    onOpenTask={() => openTask(router, t)} />
                ))}
              </View>
            </View>
          );
        })}

        {data && data.lots.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.groupTitle} accessibilityRole="header">Lotes en curso</Text>
            {data.lots.map((l) => (
              <Pressable key={l.lotId} style={styles.lot} onPress={() => router.push(`/(app)/lote/${encodeURIComponent(l.lotId)}` as never)}>
                <Text style={styles.lotName}>{l.farmName}</Text>
                <Text style={styles.meta}>
                  {varietyLabel(l.variety)} {processLabel(l.process).toLowerCase()}
                  {l.openTasks ? `, ${l.openTasks} ${l.openTasks === 1 ? 'pendiente' : 'pendientes'}` : ''}
                </Text>
                <MassFlow balance={l.balance} compact />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function TaskRow({ task, first, onOpenLot, onOpenTask }: { task: WorkflowTask; first: boolean; onOpenLot: () => void; onOpenTask: () => void }) {
  const copy = describeTask(task);
  const lot = task.lot;
  return (
    <View style={[styles.task, !first && styles.taskDivider, task.urgency === 'late' && { backgroundColor: colors.lateTint }]}>
      <Pressable onPress={onOpenLot} style={{ gap: 4 }} accessibilityRole="button" accessibilityHint="Abre la historia del lote">
        <StationThread stations={lot?.stations} focus={TASK_STATION[task.kind]} />
        <Text style={styles.taskTitle}>{copy.title}</Text>
        <Text style={styles.taskDetail}>{copy.detail}</Text>
        {lot ? <Text style={styles.meta}>{varietyLabel(lot.variety)} {processLabel(lot.process).toLowerCase()}, lote {task.lotId}</Text> : null}
      </Pressable>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={copy.action} variant={task.urgency === 'waiting' ? 'ghost' : 'primary'} onPress={onOpenTask} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  hello: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.coffee },
  summary: { fontSize: 16, lineHeight: 23, color: colors.text, marginTop: -spacing.sm },
  sync: { backgroundColor: colors.tint, borderRadius: radius.md, padding: spacing.md },
  syncText: { fontSize: 14, color: colors.coffee, lineHeight: 20 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.coffee },
  count: { fontSize: 15, color: colors.muted },
  groupHint: { fontSize: 13, color: colors.muted, marginTop: -4 },
  tasks: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  task: { padding: spacing.md, gap: spacing.md },
  taskDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  taskTitle: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25, color: colors.coffee, marginTop: 4 },
  taskDetail: { fontSize: 14, lineHeight: 20, color: colors.text },
  meta: { fontSize: 12.5, color: colors.muted },
  lot: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  lotName: { fontFamily: fonts.serif, fontSize: 17, color: colors.coffee },
  logout: { color: colors.cream, fontSize: 16 },
});
