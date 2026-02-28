"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ParameterGrid } from "./ParameterGrid";
import { WriteConfirmDialog } from "./WriteConfirmDialog";
import { ParameterSearchFilter } from "./ParameterSearchFilter";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useSettingsStore } from "@/stores/settings-store";
import { getParamMetadata, firmwareTypeToVehicle, type ParamMetadata } from "@/lib/protocol/param-metadata";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  ListTree,
} from "lucide-react";
import type { ParameterValue } from "@/lib/protocol/types";

/** Module-level cache — survives unmount/remount, avoids full re-download on navigation. */
let cachedParamList: ParameterValue[] | null = null;
let cacheTimestamp = 0;
const PARAM_LIST_CACHE_TTL = 300_000; // 5 minutes — matches adapter's PARAM_CACHE_TTL_MS

/** Natural numeric sort collator for parameter names. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Extract category prefix from a parameter name (e.g. "SERVO1_MIN" -> "SERVO"). */
function getCategory(name: string): string {
  const idx = name.indexOf("_");
  if (idx === -1) return name;
  return name.slice(0, idx).replace(/\d+$/, "");
}

export function ParametersPanel() {
  const { toast } = useToast();
  const [parameters, setParameters] = useState<ParameterValue[]>([]);
  const [modified, setModified] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [showNonDefault, setShowNonDefault] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [writeProgress, setWriteProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Map<string, ParamMetadata>>(new Map());
  const [showWriteConfirm, setShowWriteConfirm] = useState(false);
  const [showRebootPrompt, setShowRebootPrompt] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const columnVisibility = useSettingsStore((s) => s.paramColumns);
  const favoriteParams = useSettingsStore((s) => s.favoriteParams);

  useEffect(() => {
    if (cachedParamList && Date.now() - cacheTimestamp < PARAM_LIST_CACHE_TTL) {
      setParameters(cachedParamList);
    } else {
      downloadParams();
    }

    // Fetch metadata in parallel
    const drone = useDroneManager.getState().getSelectedDrone();
    if (drone?.vehicleInfo) {
      const vehicle = firmwareTypeToVehicle(drone.vehicleInfo.firmwareType);
      if (vehicle) {
        getParamMetadata(vehicle).then(setMetadata);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadParams = useCallback(async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) {
      setError("No drone connected");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 0 });
    setModified(new Map());
    setShowCommitButton(false);

    const received: ParameterValue[] = [];
    const unsub = protocol.onParameter((param) => {
      received.push(param);
      setProgress({ current: received.length, total: param.count || received.length });
    });

    try {
      const params = await protocol.getAllParameters();
      params.sort((a, b) => collator.compare(a.name, b.name));
      cachedParamList = params;
      cacheTimestamp = Date.now();
      setParameters(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download parameters");
    } finally {
      unsub();
      setLoading(false);
    }
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of parameters) {
      const cat = getCategory(p.name);
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => collator.compare(a, b));
  }, [parameters]);

  const filteredParams = useMemo(() => {
    let result = parameters;
    if (category) {
      result = result.filter((p) => getCategory(p.name) === category);
    }
    if (showNonDefault) {
      result = result.filter((p) => {
        const meta = metadata.get(p.name);
        if (meta?.defaultValue === undefined && meta?.defaultValue !== 0) return false;
        const current = modified.has(p.name) ? modified.get(p.name)! : p.value;
        return current !== meta?.defaultValue;
      });
    }
    if (showFavorites) {
      result = result.filter((p) => favoriteParams.includes(p.name));
    }
    return result;
  }, [parameters, category, showNonDefault, showFavorites, favoriteParams, modified, metadata]);

  const handleModify = useCallback((name: string, value: number) => {
    setModified((prev) => {
      const original = parameters.find((p) => p.name === name);
      if (original && original.value === value) {
        const next = new Map(prev);
        next.delete(name);
        return next;
      }
      return new Map(prev).set(name, value);
    });
  }, [parameters]);

  const handleSave = useCallback(async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol || modified.size === 0) return;
    setShowWriteConfirm(true);
  }, [modified]);

  const doWrite = useCallback(async () => {
    setShowWriteConfirm(false);
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol || modified.size === 0) return;

    setSaving(true);
    setError(null);
    const failures: string[] = [];
    const entries = Array.from(modified.entries());
    setWriteProgress({ current: 0, total: entries.length });

    for (let i = 0; i < entries.length; i++) {
      const [name, value] = entries[i];
      setWriteProgress({ current: i + 1, total: entries.length });
      const param = parameters.find((p) => p.name === name);
      try {
        const result = await protocol.setParameter(name, value, param?.type);
        if (!result.success) failures.push(`${name}: ${result.message}`);
      } catch {
        failures.push(`${name}: write failed`);
      }
    }

    if (failures.length > 0) {
      setError(`Failed to write ${failures.length} param(s): ${failures.join(", ")}`);
      toast(`Failed to write ${failures.length} parameter(s)`, "error");
    } else {
      const needsReboot = entries.some(([name]) => metadata.get(name)?.rebootRequired);

      setParameters((prev) => {
        const updated = prev.map((p) => {
          const newVal = modified.get(p.name);
          return newVal !== undefined ? { ...p, value: newVal } : p;
        });
        cachedParamList = updated;
        cacheTimestamp = Date.now();
        return updated;
      });
      setModified(new Map());
      setShowCommitButton(true);
      toast(`Wrote ${entries.length} parameter(s) to FC`, "success");

      if (needsReboot) {
        setShowRebootPrompt(true);
      }
    }
    setSaving(false);
    setWriteProgress({ current: 0, total: 0 });
  }, [modified, parameters, metadata, toast]);

  const writeChanges = useMemo(() => {
    return Array.from(modified.entries()).map(([name, newValue]) => ({
      name,
      oldValue: parameters.find((p) => p.name === name)?.value ?? 0,
      newValue,
    }));
  }, [modified, parameters]);

  const handleRevert = useCallback(() => {
    setModified(new Map());
  }, []);

  const handleResetDefaults = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleResetConfirm = useCallback(async () => {
    setShowResetConfirm(false);
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) {
      setError("No drone connected");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await protocol.resetParametersToDefault();
      if (result.success) {
        await new Promise((r) => setTimeout(r, 1000));
        await downloadParams();
        setShowRebootPrompt(true);
      } else {
        setError(`Reset failed: ${result.message}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset command failed");
    } finally {
      setSaving(false);
    }
  }, [downloadParams]);

  const handleExport = useCallback(() => {
    const lines = parameters.map((p) => {
      const val = modified.has(p.name) ? modified.get(p.name)! : p.value;
      return `${p.name} ${val}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `params_${new Date().toISOString().slice(0, 10)}.param`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parameters, modified]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const newMods = new Map(modified);
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const parts = trimmed.split(/[\s,]+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const value = parseFloat(parts[1]);
          if (!isNaN(value) && parameters.some((p) => p.name === name)) {
            const orig = parameters.find((p) => p.name === name);
            if (orig && orig.value !== value) {
              newMods.set(name, value);
            } else {
              newMods.delete(name);
            }
          }
        }
      }
      setModified(newMods);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [parameters, modified]);

  const handleCommitFlash = useCallback(async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (protocol) {
      try {
        const result = await protocol.commitParamsToFlash();
        if (result.success) {
          setShowCommitButton(false);
          toast("Written to flash — persists after reboot", "success");
        } else {
          toast("Failed to write to flash", "error");
        }
      } catch {
        toast("Failed to write to flash", "error");
      }
    }
  }, [toast]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ParameterSearchFilter
        filter={filter}
        onFilterChange={setFilter}
        showModifiedOnly={showModifiedOnly}
        onToggleModified={() => setShowModifiedOnly(!showModifiedOnly)}
        showNonDefault={showNonDefault}
        onToggleNonDefault={() => setShowNonDefault(!showNonDefault)}
        showFavorites={showFavorites}
        onToggleFavorites={() => setShowFavorites(!showFavorites)}
        paramCount={parameters.length}
        modifiedCount={modified.size}
        loading={loading}
        saving={saving}
        progress={progress}
        writeProgress={writeProgress}
        error={error}
        onDismissError={() => setError(null)}
        onExport={handleExport}
        onImport={handleImport}
        onRevert={handleRevert}
        onResetDefaults={handleResetDefaults}
        onSave={handleSave}
        onRefresh={downloadParams}
        showCommitButton={showCommitButton}
        onCommitFlash={handleCommitFlash}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {!loading && parameters.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-tertiary">
            <ListTree size={32} strokeWidth={1.5} />
            <p className="text-sm">No parameters loaded</p>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={downloadParams}>
              Download from FC
            </Button>
          </div>
        ) : (
          <>
            {parameters.length > 0 && (
              <nav className="w-[180px] flex-shrink-0 border-r border-border-default bg-bg-secondary overflow-y-auto">
                <div className="px-3 py-2 border-b border-border-default">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Categories</span>
                </div>
                <div className="flex flex-col py-1">
                  <button
                    onClick={() => setCategory(null)}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer",
                      category === null
                        ? "text-accent-primary bg-accent-primary/10 border-l-2 border-l-accent-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-l-transparent"
                    )}
                  >
                    <span>All</span>
                    <span className="text-[10px] text-text-tertiary font-mono">{parameters.length}</span>
                  </button>
                  {categories.map(([cat, count]) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer",
                        category === cat
                          ? "text-accent-primary bg-accent-primary/10 border-l-2 border-l-accent-primary"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-l-transparent"
                      )}
                    >
                      <span className="font-mono truncate">{cat}</span>
                      <span className="text-[10px] text-text-tertiary font-mono ml-1">{count}</span>
                    </button>
                  ))}
                </div>
              </nav>
            )}

            <ParameterGrid
              parameters={filteredParams}
              modified={modified}
              onModify={handleModify}
              filter={filter}
              showModifiedOnly={showModifiedOnly}
              metadata={metadata}
              columnVisibility={columnVisibility}
            />
          </>
        )}
      </div>

      {/* Write confirmation dialog */}
      <WriteConfirmDialog
        open={showWriteConfirm}
        onCancel={() => setShowWriteConfirm(false)}
        onConfirm={doWrite}
        changes={writeChanges}
      />

      {/* Reset to defaults confirmation */}
      <ConfirmDialog
        open={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleResetConfirm}
        title="Reset to Factory Defaults"
        message="This will reset ALL parameters to firmware defaults. You will need to re-calibrate sensors afterward. The flight controller will require a reboot."
        confirmLabel="Reset All Parameters"
        variant="danger"
      />

      {/* Reboot prompt */}
      <ConfirmDialog
        open={showRebootPrompt}
        onCancel={() => setShowRebootPrompt(false)}
        onConfirm={async () => {
          const protocol = useDroneManager.getState().getSelectedProtocol();
          if (protocol) await protocol.reboot();
          setShowRebootPrompt(false);
        }}
        title="Reboot Required"
        message="Some parameters you changed require a flight controller reboot to take effect. Reboot now?"
        confirmLabel="Reboot FC"
        variant="primary"
      />
    </div>
  );
}
