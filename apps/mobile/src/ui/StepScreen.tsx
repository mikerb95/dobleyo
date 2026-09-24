// Marco de cada paso: objetivo arriba, campos en el medio y, fijo abajo,
// la consecuencia de lo digitado junto al botón que lo guarda.

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme';
import { Button } from './form';

export function StepScreen({
  lot, title, intro, children, consequence, error, submitLabel, busy, onSubmit, onCancel,
}: {
  lot?: string | null; title: string; intro?: string; children: ReactNode; consequence?: ReactNode;
  error?: string | null; submitLabel: string; busy?: boolean; onSubmit: () => void; onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          {lot ? <Text style={styles.lot}>{lot}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
        </View>
        {children}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: spacing.md + insets.bottom }]}>
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
        ) : consequence ? (
          <Text style={styles.consequence} accessibilityLiveRegion="polite">{consequence}</Text>
        ) : null}
        <View style={styles.actions}>
          <View style={{ flex: 1 }}><Button label="Cancelar" variant="ghost" onPress={onCancel} /></View>
          <View style={{ flex: 1.6 }}><Button label={submitLabel} onPress={onSubmit} busy={busy} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export const stepStyles = StyleSheet.create({
  strong: { fontWeight: '700', color: colors.coffee },
});

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  head: { gap: 6, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lot: { fontSize: 12, color: colors.muted },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: colors.coffee },
  intro: { fontSize: 15, lineHeight: 22, color: colors.text },
  foot: {
    paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  consequence: { fontSize: 15, lineHeight: 21, color: colors.text },
  error: { fontSize: 14, lineHeight: 20, color: colors.danger, backgroundColor: colors.errorBg, padding: spacing.sm, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
