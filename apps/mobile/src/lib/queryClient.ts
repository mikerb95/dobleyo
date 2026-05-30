import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache amplio: las lecturas siguen disponibles sin conexión.
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 60 * 24, // 24 h (persistido)
      retry: 2,
      refetchOnReconnect: true,
    },
  },
});

// Persistidor: la caché sobrevive cierres de la app (lecturas offline).
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'dobleyo.query-cache',
});
