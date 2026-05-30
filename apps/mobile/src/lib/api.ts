import { createApiClient, createApi } from '@dobleyo/shared';
import { API_BASE_URL } from '../config';
import { secureTokenStore } from './tokenStore';

// Callback registrado por AuthContext para reaccionar a un fallo de auth
// definitivo (refresh inválido): limpia sesión y redirige a login.
let authErrorHandler: (() => void) | null = null;
export function onAuthError(handler: () => void) {
  authErrorHandler = handler;
}

const client = createApiClient({
  baseUrl: API_BASE_URL,
  tokens: secureTokenStore,
  onAuthError: () => authErrorHandler?.(),
});

export const api = createApi(client);
