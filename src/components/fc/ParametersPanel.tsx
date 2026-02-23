"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParameterGrid } from "./ParameterGrid";
import { useDroneManager } from "@/stores/drone-manager";
import { cn } from "@/lib/utils";
import {
  Search,
  Download,
  Upload,
  Save,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import type { ParameterValue } from "@/lib/protocol/types";

/** Extract category prefix from a parameter name (e.g. "SERVO1_MIN" → "SERVO"). */
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    downloadParams();
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

    const received: ParameterValue[] = [];
    const unsub = protocol.onParameter((param) => {
      received.push(param);
      setProgress({ current: received.length, total: param.count || received.length });
    });

    try {
      const params = await protocol.getAllParameters();
      params.sort((a, b) => a.name.localeCompare(b.name));
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
      .sort(([a], [b]) => a.localeCompare(b));
  }, [parameters]);

  const filteredParams = useMemo(() => {
    let result = parameters;
    if (category) {
      result = result.filter((p) => getCategory(p.name) === category);
    }
    return result;
  }, [parameters, category]);

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

    setSaving(true);
    setError(null);
    const failures: string[] = [];

    for (const [name, value] of modified) {
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
      setParameters((prev) =>
        prev.map((p) => {
          const newVal = modified.get(p.name);
          return newVal !== undefined ? { ...p, value: newVal } : p;
        })
      );
      setModified(new Map());
    }
    setSaving(false);
  }, [modified, parameters]);

  const handleRevert = useCallback(() => {
    setModified(new Map());
  }, []);

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

        <div className="flex items-center gap-2">
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

          <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={handleExport} disabled={parameters.length === 0}>Export</Button>
          <Button variant="secondary" size="sm" icon={<Upload size={12} />} onClick={() => fileInputRef.current?.click()} disabled={parameters.length === 0}>Import</Button>
          <input ref={fileInputRef} type="file" accept=".param,.txt" className="hidden" onChange={handleImport} />

          <div className="w-px h-5 bg-border-default" />

          <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />} onClick={handleRevert} disabled={modified.size === 0}>Revert</Button>
          <Button variant="primary" size="sm" icon={<Save size={12} />} onClick={handleSave} disabled={modified.size === 0} loading={saving}>Save ({modified.size})</Button>
          <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={downloadParams} disabled={loading} loading={loading}>Refresh</Button>
        </div>
      </div>

      {loading && (
        <div className="flex-shrink-0 px-4 py-2 bg-bg-secondary border-b border-border-default">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary">Downloading parameters... {progress.current}/{progress.total}</span>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary transition-all duration-200" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-xs text-text-tertiary font-mono">{progressPercent}%</span>
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

        <ParameterGrid parameters={filteredParams} modified={modified} onModify={handleModify} filter={filter} />
      </div>
    </div>
  );
}
