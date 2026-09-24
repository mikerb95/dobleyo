import { Platform } from 'react-native';

// Paleta de marca DobleYo — espejo de las variables CSS de la web
// (public/assets/css/styles.css :root).
export const colors = {
  coffee: '#251a14',
  cream: '#f7f3ef',
  background: '#f7f3ef',
  card: '#ffffff',
  border: '#e6e6e6',
  text: '#1f2937',
  muted: '#6b7280',
  accent: '#c67b4e',
  accentContrast: '#ffffff',
  primary: '#251a14',
  danger: '#b91c1c',
  success: '#15803d',

  // Flujo guiado de producción: estados del café en la barra de masa y
  // niveles de urgencia (espejo de workflow.module.css en la web).
  wfGreen: '#9fbfa4',
  wfMaquila: '#e2bd92',
  wfRoasted: '#3f2a1c',
  wfPacked: '#8a5a33',
  wfLoss: '#d9cfc4',
  late: '#b91c1c',
  now: '#c67b4e',
  waiting: '#8c7b70',
  anytime: '#b8aca3',
  tint: '#f3e6d9',
  lateTint: '#fbf1ef',
  costBg: '#fbf4ec',
  costBorder: '#f0dfcb',
  errorBg: '#fdecec',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

// Serif del sistema para las frases de objetivo (en la web es Fraunces).
export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
} as const;
