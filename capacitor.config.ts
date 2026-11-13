import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestordegastos.app',
  appName: 'Control de Gastos',
  webDir: 'out',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '505851925373-rn8c8fnrjnht0qllfsldrnlnjoihijpf.apps.googleusercontent.com',
      androidClientId: '505851925373-rn8c8fnrjnht0qllfsldrnlnjoihijpf.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
