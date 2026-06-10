import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from '../src/auth/AuthContext';
import { queryClient, persister } from '../src/lib/queryClient';
// Registra los mutation defaults (cola offline) antes de restaurar la caché.
import '../src/lib/mutations';

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      // Tras restaurar la caché persistida, reanuda las mutaciones que
      // quedaron encoladas offline en la sesión anterior.
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
