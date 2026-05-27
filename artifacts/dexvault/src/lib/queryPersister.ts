import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// ─── Cache version ────────────────────────────────────────────────────────
// Bump this string whenever a query shape changes in a breaking way so that
// stale localStorage data from old versions is automatically discarded.
export const CACHE_BUSTER = 'v1';

// ─── localStorage persister ───────────────────────────────────────────────
// Serialises the React Query in-memory cache to localStorage so that card
// data, search results, and set lists are available instantly on the NEXT
// page load — no network round-trip needed for recently viewed content.
//
// Throttled to 1 s so rapid state changes don't thrash the serialiser.
// Safe to create at module level (window is always available in a browser).
export const localStoragePersister = createSyncStoragePersister({
  key: 'vault151-query-cache',
  storage: window.localStorage,
  throttleTime: 1000,
});
