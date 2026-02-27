import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";

const CRITICAL_PREFIXES = ["FS_", "BATT_FS_", "FENCE_", "MOT_", "BRD_SAFETY", "ARMING_"];

const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes

interface PendingWrite {
  panel: string;
  paramName: string;
  oldValue: number;
  newValue: number;
  timestamp: number;
}

interface FlashCommitEntry {
  timestamp: number;
  paramCount: number;
  success: boolean;
}

interface ParamSafetyStoreState {
  pendingWrites: Map<string, PendingWrite>;
  flashCommitLog: RingBuffer<FlashCommitEntry>;
  lastFlashCommit: number;
  panelStaleness: Map<string, number>;

  trackWrite: (paramName: string, oldValue: number, newValue: number, panel: string) => void;
  removeWrite: (paramName: string) => void;
  commitFlash: (success?: boolean) => void;
  getPendingCount: () => number;
  hasCriticalPending: () => boolean;
  markPanelLoaded: (panel: string) => void;
  isPanelStale: (panel: string, maxAgeMs?: number) => boolean;
  clear: () => void;
}

export const useParamSafetyStore = create<ParamSafetyStoreState>((set, get) => ({
  pendingWrites: new Map(),
  flashCommitLog: new RingBuffer<FlashCommitEntry>(10),
  lastFlashCommit: 0,
  panelStaleness: new Map(),

  trackWrite: (paramName, oldValue, newValue, panel) => {
    const pending = get().pendingWrites;
    pending.set(paramName, {
      panel,
      paramName,
      oldValue,
      newValue,
      timestamp: Date.now(),
    });
    set({}); // trigger re-render
  },

  removeWrite: (paramName) => {
    get().pendingWrites.delete(paramName);
    set({});
  },

  commitFlash: (success = true) => {
    const s = get();
    const count = s.pendingWrites.size;
    s.flashCommitLog.push({
      timestamp: Date.now(),
      paramCount: count,
      success,
    });
    s.pendingWrites.clear();
    set({ lastFlashCommit: Date.now() });
  },

  getPendingCount: () => get().pendingWrites.size,

  hasCriticalPending: () => {
    const pending = get().pendingWrites;
    for (const paramName of pending.keys()) {
      if (CRITICAL_PREFIXES.some((prefix) => paramName.startsWith(prefix))) {
        return true;
      }
    }
    return false;
  },

  markPanelLoaded: (panel) => {
    get().panelStaleness.set(panel, Date.now());
    set({});
  },

  isPanelStale: (panel, maxAgeMs = DEFAULT_STALE_MS) => {
    const loaded = get().panelStaleness.get(panel);
    if (loaded === undefined) return true;
    return Date.now() - loaded > maxAgeMs;
  },

  clear: () =>
    set({
      pendingWrites: new Map(),
      flashCommitLog: new RingBuffer<FlashCommitEntry>(10),
      lastFlashCommit: 0,
      panelStaleness: new Map(),
    }),
}));
