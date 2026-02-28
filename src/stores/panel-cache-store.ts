import { create } from "zustand";

interface PanelCacheEntry {
  params: Map<string, number>;
  originalValues: Map<string, number>;
  timestamp: number;
}

interface PanelCacheState {
  cache: Map<string, PanelCacheEntry>;
  cachePanel: (panelId: string, params: Map<string, number>, originalValues: Map<string, number>) => void;
  getCachedPanel: (panelId: string) => PanelCacheEntry | null;
  invalidateParam: (paramName: string) => void;
  invalidatePanel: (panelId: string) => void;
  clear: () => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const usePanelCacheStore = create<PanelCacheState>((set, get) => ({
  cache: new Map(),

  cachePanel: (panelId, params, originalValues) => {
    const cache = new Map(get().cache);
    cache.set(panelId, {
      params: new Map(params),
      originalValues: new Map(originalValues),
      timestamp: Date.now(),
    });
    set({ cache });
  },

  getCachedPanel: (panelId) => {
    const entry = get().cache.get(panelId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      // Expired — remove and return null
      const cache = new Map(get().cache);
      cache.delete(panelId);
      set({ cache });
      return null;
    }
    return entry;
  },

  invalidateParam: (paramName) => {
    const cache = new Map(get().cache);
    for (const [panelId, entry] of cache) {
      if (entry.params.has(paramName)) {
        cache.delete(panelId);
      }
    }
    set({ cache });
  },

  invalidatePanel: (panelId) => {
    const cache = new Map(get().cache);
    cache.delete(panelId);
    set({ cache });
  },

  clear: () => set({ cache: new Map() }),
}));
