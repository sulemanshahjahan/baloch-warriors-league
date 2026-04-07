# Offline Support Setup

This document explains how the offline support is configured for the BWL mobile app.

## Overview

The app supports offline functionality through:

1. **Service Worker (PWA)** - Caches static assets and pages
2. **localStorage Cache** - Caches API responses
3. **Action Queue** - Queues actions for sync when back online
4. **Offline UI** - Visual indicators for offline state

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ OfflineProvider │  │ OfflineIndicator│  │ useOfflineData│ │
│  └────────┬────────┘  └─────────────────┘  └──────────────┘ │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Cache Layer (localStorage)              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   API Cache     │  │  Action Queue   │                   │
│  │   (TTL based)   │  │  (pending sync) │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Worker (Workbox)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Page Cache     │  │  Static Assets  │  │ Image Cache  │ │
│  │ (StaleWhileReval│  │  (CacheFirst)   │  │ (CacheFirst) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── lib/offline/
│   ├── cache.ts       # Core caching utilities
│   ├── provider.tsx   # React context for offline state
│   └── index.ts       # Exports
├── components/offline/
│   ├── offline-indicator.tsx   # Bottom banner for offline state
│   └── offline-data-card.tsx   # Example data card with offline badges
├── hooks/
│   └── use-offline-data.ts     # Hook for offline-aware data fetching
public/
└── manifest.json      # PWA manifest
```

## Usage

### 1. Basic Offline-Aware Data Fetching

```tsx
import { useOfflineData } from "@/hooks/use-offline-data";

function TournamentList() {
  const { data, isLoading, isOffline, isCached, refetch } = useOfflineData({
    url: "/api/tournaments",
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

  return (
    <div>
      {isOffline && <span>Offline mode - showing cached data</span>}
      {data?.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
    </div>
  );
}
```

### 2. Queueing Actions for Later Sync

```tsx
import { queueAction } from "@/lib/offline";
import { useOffline } from "@/lib/offline/provider";

function MyComponent() {
  const { isConnected, queuedCount } = useOffline();

  const handleSubmit = async (formData) => {
    if (!isConnected) {
      // Queue for later sync
      queueAction("CREATE_COMMENT", formData);
      toast.success("Saved! Will sync when online.");
      return;
    }

    // Submit normally
    await submitForm(formData);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 3. Providing Sync Handler

```tsx
import { OfflineProvider } from "@/lib/offline/provider";

function App() {
  const handleSync = async (type: string, payload: unknown) => {
    switch (type) {
      case "CREATE_COMMENT":
        await fetch("/api/comments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return true;
      default:
        return false;
    }
  };

  return (
    <OfflineProvider onSync={handleSync}>
      <YourApp />
    </OfflineProvider>
  );
}
```

## Capacitor Configuration

The `capacitor.config.ts` is configured to use bundled assets:

```typescript
const config: CapacitorConfig = {
  appId: 'com.bwl.league',
  appName: 'BWL',
  webDir: 'out',  // Next.js static export
  // server.url is commented out for offline mode
  // Uncomment for development with live site
};
```

### Switching Between Modes

**For Development (Live Site):**
```typescript
server: {
  url: 'https://www.bwlleague.com',
  cleartext: false,
}
```

**For Production (Offline):**
```typescript
// Remove or comment out server.url
// Assets will be served from bundled 'out' directory
```

## Building for Offline

1. **Build static export:**
   ```bash
   pnpm build
   ```

2. **Sync with Capacitor:**
   ```bash
   npx cap sync android
   ```

3. **Build APK in Android Studio:**
   - Open `android/` folder in Android Studio
   - Build → Generate Signed Bundle / APK

## Cache Strategies

### Service Worker (Workbox)

| Resource Type | Strategy | Max Age |
|--------------|----------|---------|
| API calls | NetworkFirst | 24 hours |
| Pages | StaleWhileRevalidate | 7 days |
| JS/CSS | CacheFirst | 30 days |
| Images | CacheFirst | 30 days |

### localStorage (Custom Cache)

| Data Type | Default TTL |
|-----------|-------------|
| Tournament lists | 24 hours |
| Match data | 1 hour |
| Player stats | 24 hours |
| User preferences | 7 days |

## Testing Offline Mode

### Browser DevTools:
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Refresh page - should load from cache

### Capacitor App:
1. Build and install APK
2. Enable Airplane mode
3. Open app - should show cached data
4. Check offline indicator banner at bottom

## Limitations

1. **First Load**: Requires internet for initial data
2. **API Cache Size**: localStorage limited to ~5-10MB
3. **Image Cache**: Service worker caches images, not base64 from DB
4. **Real-time**: Live matches won't update without connection

## Future Improvements

- [ ] Background sync for queued actions
- [ ] IndexedDB for larger data storage
- [ ] Periodic background refresh
- [ ] Smart cache eviction (LRU)
- [ ] Offline-first data fetching pattern
