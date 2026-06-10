import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme';

/** Guard del grupo autenticado: sin sesión válida se vuelve al login. */
export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.coffee },
        headerTintColor: colors.cream,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
