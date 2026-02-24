"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ParameterGrid } from "./ParameterGrid";
import { ColumnVisibilityToggle } from "./ColumnVisibilityToggle";
import { WriteConfirmDialog } from "./WriteConfirmDialog";
import { useDroneManager } from "@/stores/drone-manager";
import { useSettingsStore } from "@/stores/settings-store";
import { getParamMetadata, firmwareTypeToVehicle, type ParamMetadata } from "@/lib/protocol/param-metadata";
import { cn } from "@/lib/utils";
import {
  Search,
  Download,
  Upload,
  PenLine,
  RotateCcw,
  RotateCw,
  RefreshCw,
  AlertTriangle,
  Filter,
  ListTree,
  Star,
  HardDrive,
  Zap,
} from "lucide-react";
import type { ParameterValue } from "@/lib/protocol/types";

/** Natural numeric sort collator for parameter names. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Extract category prefix from a parameter name (e.g. "SERVO1_MIN" -> "SERVO"). */
function getCategory(name: string): string {
  const idx = name.indexOf("_");
  if (idx === -1) return name;
  return name.slice(0, idx).replace(/\d+$/, "");
}

export function ParametersPanel() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const columnVisibility = useSettingsStore((s) => s.paramColumns);
  const favoriteParams = useSettingsStore((s) => s.favoriteParams);

  useEffect(() => {
    downloadParams();

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
    } else {
      // Check if any written param needs reboot
      const needsReboot = entries.some(([name]) => metadata.get(name)?.rebootRequired);

      setParameters((prev) =>
        prev.map((p) => {
          const newVal = modified.get(p.name);
          return newVal !== undefined ? { ...p, value: newVal } : p;
        })
      );
      setModified(new Map());
      setShowCommitButton(true);

      if (needsReboot) {
        setShowRebootPrompt(true);
      }
    }
    setSaving(false);
    setWriteProgress({ current: 0, total: 0 });
  }, [modified, parameters, metadata]);

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
        // Wait for FC to finish applying defaults before re-downloading
        await new Promise((r) => setTimeout(r, 1000));
        await downloadParams();
        // Factory reset always requires reboot
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

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border-default bg-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-sm font-display font-semibold text-text-primary">
            FC Parameters
          </h1>
          {parameters.length > 0 && (
            <Badge variant="info" size="sm">{parameters.length} params</Badge>
          )}
          {modified.size > 0 && (
            <Badge variant="warning" size="sm">{modified.size} changed</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filters group */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search parameters..."
              className="w-full h-8 pl-7 pr-2 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>

          <Button
            variant={showModifiedOnly ? "primary" : "ghost"}
            size="sm"
            icon={<Filter size={12} />}
            onClick={() => setShowModifiedOnly(!showModifiedOnly)}
            className={cn(showModifiedOnly && "bg-status-warning text-bg-primary hover:bg-status-warning/90")}
          >
            Modified
          </Button>

          <Button
            variant={showNonDefault ? "primary" : "ghost"}
            size="sm"
            icon={<Zap size={12} />}
            onClick={() => setShowNonDefault(!showNonDefault)}
            className={cn(showNonDefault && "bg-accent-primary text-bg-primary hover:bg-accent-primary/90")}
          >
            Non-Default
          </Button>

          <Button
            variant={showFavorites ? "primary" : "ghost"}
            size="sm"
            icon={<Star size={12} />}
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(showFavorites && "bg-status-warning text-bg-primary hover:bg-status-warning/90")}
          >
            Favorites
          </Button>

          <ColumnVisibilityToggle />

          <div className="w-px h-5 bg-border-default" />

          {/* File ops group */}
          <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={handleExport} disabled={parameters.length === 0}>Export</Button>
          <Button variant="secondary" size="sm" icon={<Upload size={12} />} onClick={() => fileInputRef.current?.click()} disabled={parameters.length === 0}>Import</Button>
          <input ref={fileInputRef} type="file" accept=".param,.txt" className="hidden" onChange={handleImport} />

          <div className="w-px h-5 bg-border-default" />

          {/* Changes group */}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />} onClick={handleRevert} disabled={modified.size === 0}>Revert</Button>
          <Button variant="ghost" size="sm" icon={<RotateCw size={12} />} onClick={handleResetDefaults} disabled={parameters.length === 0 || saving}>Reset to Default</Button>
          <Button variant="primary" size="sm" icon={<PenLine size={12} />} onClick={handleSave} disabled={modified.size === 0} loading={saving}>
            {saving ? `Writing ${writeProgress.current}/${writeProgress.total}...` : `Write to FC (${modified.size})`}
          </Button>

          {showCommitButton && (
            <Button
              variant="secondary"
              size="sm"
              icon={<HardDrive size={12} />}
              onClick={async () => {
                const protocol = useDroneManager.getState().getSelectedProtocol();
                if (protocol) {
                  await protocol.commitParamsToFlash();
                  setShowCommitButton(false);
                }
              }}
            >
              Commit to Flash
            </Button>
          )}

          <div className="w-px h-5 bg-border-default" />

          {/* Sync group */}
          <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={downloadParams} disabled={loading} loading={loading}>Refresh</Button>
        </div>
      </div>

      {loading && (
        <div className="flex-shrink-0 px-4 py-2 bg-bg-secondary border-b border-border-default">
          <div className="flex items-center gap-3">
            <RefreshCw size={12} className="text-accent-primary animate-spin flex-shrink-0" />
            <span className="text-xs text-text-secondary">Downloading parameters... {progress.current}/{progress.total}</span>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary transition-all duration-200" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-xs text-text-tertiary font-mono">{progressPercent}%</span>
          </div>
        </div>
      )}

      {saving && writeProgress.total > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-bg-secondary border-b border-border-default">
          <div className="flex items-center gap-3">
            <PenLine size={12} className="text-status-warning flex-shrink-0" />
            <span className="text-xs text-text-secondary">Writing parameters... {writeProgress.current}/{writeProgress.total}</span>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-status-warning transition-all duration-200" style={{ width: `${Math.round((writeProgress.current / writeProgress.total) * 100)}%` }} />
            </div>
            <span className="text-xs text-text-tertiary font-mono">{Math.round((writeProgress.current / writeProgress.total) * 100)}%</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-status-error/10 border-b border-status-error/30 flex items-center gap-2">
          <AlertTriangle size={14} className="text-status-error flex-shrink-0" />
          <span className="text-xs text-status-error">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-xs text-status-error hover:text-status-error/80 cursor-pointer">Dismiss</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
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
