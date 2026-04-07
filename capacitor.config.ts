import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bwl.league',
  appName: 'BWL',
  webDir: 'out',
  // For offline support, comment out the server.url to use bundled assets
  // When developing/testing with live site, uncomment server.url
  // server: {
  //   url: 'https://www.bwlleague.com',
  //   cleartext: false,
  // },
  plugins: {
    // Enable local storage for offline data
    CapacitorCookies: {
      enabled: true,
    },
  },
  android: {
    // Enable offline support
    allowMixedContent: true,
    // Keep WebView cache for offline
    webContentsDebuggingEnabled: false,
  },
};

export default config;
