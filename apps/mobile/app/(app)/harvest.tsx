import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Harvest, HarvestInput, WithClientOpId } from '@dobleyo/shared';
import { api } from '../../src/lib/api';
import { mutationKeys, queryKeys, withOpId } from '../../src/lib/mutations';
import { colors, radius, spacing } from '../../src/theme';

const EMPTY: HarvestInput = {
  farm: '',
  region: '',
  variety: '',
  climate: '',
  process: '',
  aroma: '',
  tasteNotes: '',
};

const FIELDS: Array<{ key: keyof HarvestInput; label: string; required?: boolean }> = [
  { key: 'farm', label: 'Finca', required: true },
  { key: 'region', label: 'Región' },
  { key: 'altitude', label: 'Altitud (msnm)' },
  { key: 'variety', label: 'Variedad', required: true },
  { key: 'climate', label: 'Clima', required: true },
  { key: 'process', label: 'Proceso', required: true },
  { key: 'aroma', label: 'Aroma', required: true },
  { key: 'tasteNotes', label: 'Notas de sabor', required: true },
];

export default function HarvestScreen() {
  const router = useRouter();
  const [form, setForm] = useState<HarvestInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const harvests = useQuery({
    queryKey: queryKeys.harvests,
    queryFn: () => api.production.getHarvests(),
  });

  // El mutationFn viene de los defaults registrados en src/lib/mutations.ts;
  // los genéricos son necesarios porque useMutation no los infiere de ahí.
  const createHarvest = useMutation<unknown, Error, HarvestInput & WithClientOpId>({
    mutationKey: mutationKeys.harvest,
  });

  const onSubmit = () => {
    const missing = FIELDS.filter((f) => f.required && !String(form[f.key] ?? '').trim());
    if (missing.length > 0) {
      setError(`Complete los campos requeridos: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    setError(null);
    // mutate() sin await: si no hay conexión la mutación queda encolada
    // (persistida) y se sincroniza al reconectar, con client_op_id para
    // que el reintento no duplique la cosecha.
    createHarvest.mutate(withOpId({ ...form }));
    setForm(EMPTY);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Registrar cosecha' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.label}
                  placeholderTextColor={colors.muted}
                  value={String(form[field.key] ?? '')}
                  keyboardType={field.key === 'altitude' ? 'numeric' : 'default'}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))}
                />
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onSubmit}
            >
              <Text style={styles.buttonText}>Registrar cosecha</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Cosechas recientes</Text>
          {harvests.isLoading ? (
            <Text style={styles.muted}>Cargando…</Text>
          ) : (harvests.data ?? []).length === 0 ? (
            <Text style={styles.muted}>Aún no hay cosechas registradas.</Text>
          ) : (
            (harvests.data ?? []).slice(0, 10).map((h: Harvest) => (
              <View key={String(h.id)} style={styles.listItem}>
                <Text style={styles.listTitle}>{h.farm}</Text>
                <Text style={styles.muted}>
                  {[h.region, h.variety, h.process].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.accentContrast,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.coffee,
  },
  listItem: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
});
