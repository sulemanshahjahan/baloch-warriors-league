import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bwl.league',
  appName: 'BWL',
  webDir: 'dist-cap',
  server: {
    url: 'https://www.bwlleague.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: '#09090b',
    },
  },
};

export default config;
