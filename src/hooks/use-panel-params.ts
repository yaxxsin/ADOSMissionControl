import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useParamSafetyStore } from "@/stores/param-safety-store";
import { usePanelCacheStore } from "@/stores/panel-cache-store";

interface PanelParamEvent {
  type: "read" | "write" | "flash" | "error" | "info";
  message: string;
}

interface PanelParamOptions {
  /** List of parameter names to load */
  paramNames: string[];
  /** Params that may not exist on all firmware — fail silently */
  optionalParams?: string[];
  /** Panel identifier for tracking */
  panelId: string;
  /** Whether to auto-load on mount (default: false) */
  autoLoad?: boolean;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Concurrent fetch batch size (default: 8) */
  batchSize?: number;
  /** Optional callback for logging parameter operations */
  onEvent?: (event: PanelParamEvent) => void;
}

interface PanelParamState {
  params: Map<string, number>;
  loading: boolean;
  error: string | null;
  /** Which params have been modified but not saved to RAM */
  dirtyParams: Set<string>;
  /** Whether any params have been written to RAM but not flashed */
  hasRamWrites: boolean;
  /** Progress of current load operation */
  loadProgress: { loaded: number; total: number } | null;
  /** Whether params have been loaded at least once */
  hasLoaded: boolean;
  /** Optional params that were not found on this firmware */
  missingOptional: Set<string>;
}

interface PanelParamActions {
  /** Reload all params from FC */
  refresh: () => Promise<void>;
  /** Update a param value locally (marks as dirty) */
  setLocalValue: (name: string, value: number) => void;
  /** Write a single param to RAM on the FC */
  saveToRam: (name: string, value: number) => Promise<boolean>;
  /** Write all dirty params to RAM */
  saveAllToRam: () => Promise<boolean>;
  /** Commit all RAM writes to flash */
  commitToFlash: () => Promise<boolean>;
  /** Revert a param to its loaded value */
  revert: (name: string) => void;
  /** Revert all dirty params */
  revertAll: () => void;
}

const RETRY_DELAYS = [500, 1000, 2000];
const DEFAULT_BATCH_SIZE = 8;
const EMPTY_ARRAY: string[] = [];

export function usePanelParams(
  options: PanelParamOptions,
): PanelParamState & PanelParamActions {
  const { paramNames, optionalParams = EMPTY_ARRAY, panelId, autoLoad = false, maxRetries = 3, batchSize = DEFAULT_BATCH_SIZE, onEvent } = options;
  const optionalSet = useMemo(() => new Set(optionalParams), [optionalParams]);

  const [params, setParams] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirtyParams, setDirtyParams] = useState<Set<string>>(new Set());
  const [hasRamWrites, setHasRamWrites] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [missingOptional, setMissingOptional] = useState<Set<string>>(new Set());

  // Track original loaded values for revert
  const originalValues = useRef<Map<string, number>>(new Map());
  const abortedRef = useRef(false);

  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const trackWrite = useParamSafetyStore((s) => s.trackWrite);
  const commitFlashStore = useParamSafetyStore((s) => s.commitFlash);
  const markPanelLoaded = useParamSafetyStore((s) => s.markPanelLoaded);
  const cachePanel = usePanelCacheStore((s) => s.cachePanel);
  const getCachedPanel = usePanelCacheStore((s) => s.getCachedPanel);

  const loadParams = useCallback(async () => {
    const protocol = getProtocol();
    if (!protocol || !protocol.isConnected) {
      const msg = "Not connected to flight controller";
      setError(msg);
      onEvent?.({ type: "error", message: msg });
      return;
    }

    setLoading(true);
    setError(null);
    setLoadProgress({ loaded: 0, total: paramNames.length });
    onEvent?.({ type: "info", message: `Loading ${paramNames.length} parameters...` });

    const loaded = new Map<string, number>();
    const failed: string[] = [];
    let completedCount = 0;

    // Fetch a single param with retries
    const fetchOne = async (name: string): Promise<void> => {
      if (abortedRef.current) return;
      onEvent?.({ type: "read", message: `Reading ${name}...` });
      let success = false;
      for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
        if (abortedRef.current) return;
        try {
          const result = await protocol.getParameter(name);
          loaded.set(name, result.value);
          success = true;
          onEvent?.({ type: "read", message: `${name} = ${result.value}` });
        } catch {
          if (attempt < maxRetries - 1) {
            const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      if (!success) {
        failed.push(name);
        onEvent?.({ type: "error", message: `Failed to read ${name} after ${maxRetries} retries` });
      }
    };

    try {
      // Process in batches of `batchSize` for parallelism
      for (let i = 0; i < paramNames.length; i += batchSize) {
        if (abortedRef.current) return;

        const batch = paramNames.slice(i, i + batchSize);
        await Promise.allSettled(batch.map((name) => fetchOne(name)));

        completedCount = Math.min(i + batchSize, paramNames.length);
        if (abortedRef.current) return;

        // Incremental update — UI fills in progressively
        setParams(new Map(loaded));
        setLoadProgress({ loaded: completedCount, total: paramNames.length });
      }

      if (abortedRef.current) return;

      originalValues.current = new Map(loaded);
      setParams(new Map(loaded));
      setDirtyParams(new Set());
      setHasRamWrites(false);
      setLoadProgress(null);

      if (failed.length > 0) {
        const criticalFailed = failed.filter((f) => !optionalSet.has(f));
        const optionalFailed = failed.filter((f) => optionalSet.has(f));
        if (optionalFailed.length > 0) {
          setMissingOptional(new Set(optionalFailed));
        }
        if (criticalFailed.length > 0) {
          setError(`Failed to load: ${criticalFailed.join(", ")}`);
          // Don't mark as loaded when critical params failed — show Retry, not Refresh
        } else {
          setHasLoaded(true);
        }
      } else {
        setHasLoaded(true);
      }

      markPanelLoaded(panelId);
      cachePanel(panelId, new Map(loaded), new Map(loaded));
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
      }
    }
  }, [getProtocol, paramNames, optionalSet, panelId, maxRetries, batchSize, markPanelLoaded, cachePanel, onEvent]);

  // Ref to decouple effect from loadParams identity changes during loading
  const loadParamsRef = useRef(loadParams);
  loadParamsRef.current = loadParams;

  // Restore from cache on mount (before autoLoad triggers)
  useEffect(() => {
    const cached = getCachedPanel(panelId);
    if (cached) {
      setParams(new Map(cached.params));
      originalValues.current = new Map(cached.originalValues);
      setHasLoaded(true);
      setDirtyParams(new Set());
      setHasRamWrites(false);
      markPanelLoaded(panelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load on mount (default: off)
  useEffect(() => {
    abortedRef.current = false;
    if (autoLoad) {
      loadParamsRef.current();
    }
    return () => {
      abortedRef.current = true;
    };
  }, [autoLoad]);

  const setLocalValue = useCallback(
    (name: string, value: number) => {
      setParams((prev) => {
        const next = new Map(prev);
        next.set(name, value);
        return next;
      });
      setDirtyParams((prev) => {
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    },
    [],
  );

  const saveToRam = useCallback(
    async (name: string, value: number): Promise<boolean> => {
      const protocol = getProtocol();
      if (!protocol || !protocol.isConnected) {
        onEvent?.({ type: "error", message: `Cannot save ${name}: not connected` });
        return false;
      }

      try {
        const oldValue = originalValues.current.get(name) ?? 0;
        onEvent?.({ type: "write", message: `Saving ${name} = ${value} to RAM...` });
        const result = await protocol.setParameter(name, value);
        if (result.success) {
          trackWrite(name, oldValue, value, panelId);
          setDirtyParams((prev) => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
          // Update the original to the saved value
          originalValues.current.set(name, value);
          setHasRamWrites(true);
          onEvent?.({ type: "write", message: `Saved ${name} = ${value} to RAM` });
          return true;
        }
        onEvent?.({ type: "error", message: `Failed to save ${name}` });
        return false;
      } catch {
        onEvent?.({ type: "error", message: `Error saving ${name}` });
        return false;
      }
    },
    [getProtocol, panelId, trackWrite, onEvent],
  );

  const saveAllToRam = useCallback(async (): Promise<boolean> => {
    let allOk = true;
    for (const name of dirtyParams) {
      const value = params.get(name);
      if (value !== undefined) {
        const ok = await saveToRam(name, value);
        if (!ok) allOk = false;
      }
    }
    return allOk;
  }, [dirtyParams, params, saveToRam]);

  const commitToFlash = useCallback(async (): Promise<boolean> => {
    const protocol = getProtocol();
    if (!protocol || !protocol.isConnected) {
      onEvent?.({ type: "error", message: "Cannot write to flash: not connected" });
      return false;
    }

    try {
      onEvent?.({ type: "flash", message: "Writing to flash..." });
      const result = await protocol.commitParamsToFlash();
      if (result.success) {
        commitFlashStore(true);
        setHasRamWrites(false);
        onEvent?.({ type: "flash", message: "Written to flash" });
        return true;
      }
      onEvent?.({ type: "error", message: "Failed to write to flash" });
      return false;
    } catch (err) {
      console.error(`[${panelId}] commitParamsToFlash error:`, err);
      onEvent?.({ type: "error", message: "Error writing to flash" });
      return false;
    }
  }, [getProtocol, commitFlashStore, panelId, onEvent]);

  const revert = useCallback(
    (name: string) => {
      const original = originalValues.current.get(name);
      if (original !== undefined) {
        setParams((prev) => {
          const next = new Map(prev);
          next.set(name, original);
          return next;
        });
        setDirtyParams((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [],
  );

  const revertAll = useCallback(() => {
    setParams(new Map(originalValues.current));
    setDirtyParams(new Set());
  }, []);

  return {
    params,
    loading,
    error,
    dirtyParams,
    hasRamWrites,
    loadProgress,
    hasLoaded,
    missingOptional,
    refresh: loadParams,
    setLocalValue,
    saveToRam,
    saveAllToRam,
    commitToFlash,
    revert,
    revertAll,
  };
}
