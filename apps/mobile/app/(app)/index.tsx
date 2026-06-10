import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { PRODUCTION_STAGES } from '@dobleyo/shared';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, radius, spacing } from '../../src/theme';

export default function Home() {
  const { user, logout } = useAuth();

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
        <Text style={styles.sectionTitle}>Línea de producción</Text>
        <View style={styles.grid}>
          {PRODUCTION_STAGES.map((item, index) => (
            <View key={item.stage} style={styles.card}>
              <Text style={styles.cardStep}>{index + 1}</Text>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardSoon}>Próximamente</Text>
            </View>
          ))}
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
  logout: {
    color: colors.cream,
    fontSize: 16,
  },
});
