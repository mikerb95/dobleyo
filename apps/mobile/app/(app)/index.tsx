import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutationState } from '@tanstack/react-query';
import { PRODUCTION_STAGES } from '@dobleyo/shared';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, radius, spacing } from '../../src/theme';

// Pantallas implementadas por etapa; las demás muestran "Próximamente".
const STAGE_ROUTES: Partial<Record<string, string>> = {
  harvest: '/(app)/harvest',
};

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  // Mutaciones en vuelo o pausadas offline, pendientes de llegar al servidor.
  const pendingSync = useMutationState({ filters: { status: 'pending' } }).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'DobleYo Café',
          headerRight: () => (
            <Pressable onPress={() => void logout()} hitSlop={12}>
              <Text style={styles.logout}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>
          Hola, {user ? `${user.first_name} ${user.last_name}` : ''}
        </Text>
        {pendingSync > 0 ? (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>
              {pendingSync === 1
                ? '1 operación pendiente de sincronizar'
                : `${pendingSync} operaciones pendientes de sincronizar`}
            </Text>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>Línea de producción</Text>
        <View style={styles.grid}>
          {PRODUCTION_STAGES.map((item, index) => {
            const route = STAGE_ROUTES[item.stage];
            return (
              <Pressable
                key={item.stage}
                style={({ pressed }) => [styles.card, route && pressed && styles.cardPressed]}
                disabled={!route}
                onPress={() => route && router.push(route as never)}
              >
                <Text style={styles.cardStep}>{index + 1}</Text>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={[styles.cardSoon, route && styles.cardReady]}>
                  {route ? 'Disponible' : 'Próximamente'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  greeting: {
    fontSize: 18,
    color: colors.text,
  },
  syncBadge: {
    backgroundColor: colors.coffee,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  syncText: {
    color: colors.cream,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.coffee,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardStep: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardSoon: {
    fontSize: 13,
    color: colors.muted,
  },
  cardReady: {
    color: colors.success,
    fontWeight: '600',
  },
  logout: {
    color: colors.cream,
    fontSize: 16,
  },
});
