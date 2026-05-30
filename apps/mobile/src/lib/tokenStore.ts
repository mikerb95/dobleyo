import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '@dobleyo/shared';

const ACCESS_KEY = 'dobleyo.accessToken';
const REFRESH_KEY = 'dobleyo.refreshToken';

/** TokenStore respaldado por el llavero seguro del dispositivo (Keychain/Keystore). */
export const secureTokenStore: TokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setTokens({ accessToken, refreshToken }) {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    if (refreshToken != null) {
      await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    }
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
