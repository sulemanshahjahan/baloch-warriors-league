import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bwl.league',
  appName: 'BWL',
  webDir: 'out',
  server: {
    url: 'https://www.bwlleague.com',
    cleartext: false,
  },
};

export default config;
