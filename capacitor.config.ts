import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bwl.league',
  appName: 'BWL',
  webDir: 'out',
  // Load from live website for full functionality
  server: {
    url: 'https://www.bwlleague.com',
    cleartext: false,
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
