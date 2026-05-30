import type { ExpoConfig, ConfigContext } from 'expo/config';

// API_BASE_URL por entorno. En dev apunta al servidor local Express/Astro;
// en preview/prod a producción. Sobrescribible vía variable de entorno.
const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  'https://dobleyo.cafe';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DobleYo CRM',
  slug: 'dobleyo-crm',
  scheme: 'dobleyocrm',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'cafe.dobleyo.crm',
    infoPlist: {
      NSCameraUsageDescription:
        'Se usa la cámara para escanear los códigos QR de los lotes y empaques.',
    },
  },
  android: {
    package: 'cafe.dobleyo.crm',
    permissions: ['CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Se usa la cámara para escanear los códigos QR de los lotes y empaques.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
  },
});
