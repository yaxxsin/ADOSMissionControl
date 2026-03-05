"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import {
  SlidersHorizontal, Save, RotateCcw, BarChart3, HardDrive,
  Play, Copy, Zap, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PidResponseChart } from "./PidResponseChart";
import { PidAxisRow } from "./PidAxisRow";
import {
  type PidParam, type PidPreset, type VehicleType,
  PLANE_AXES, COPTER_AXES, ACRO_PARAMS, FILTER_PARAMS, COPTER_PRESETS,
} from "./pid-constants";
import { useParamLabel } from "@/hooks/use-param-label";
import { useParamMetadataMap } from "@/hooks/use-param-metadata";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { ParamTooltip } from "./ParamTooltip";
import { PidAnalysisSection } from "./PidAnalysisSection";

export function PidTuningPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { firmwareType } = useFirmwareCapabilities();
  const isPx4 = firmwareType === 'px4';

  // Detect vehicle type from connected drone
  const drone = getSelectedDrone();
  const { paramName: pn } = useParamLabel();
  const paramMeta = useParamMetadataMap();
  const scrollRef = usePanelScroll("pid-tuning");
  const detectedVehicle: VehicleType | null = useMemo(() => {
    const vc = drone?.vehicleInfo?.vehicleClass;
    if (vc === "copter") return "copter";
    if (vc === "plane" || vc === "vtol") return "plane";
    return null;
  }, [drone?.vehicleInfo?.vehicleClass]);

  const [vehicleType, setVehicleType] = useState<VehicleType>(detectedVehicle ?? "copter");
  const activeAxes = vehicleType === "copter" ? COPTER_AXES : PLANE_AXES;

  // Expanded sections state
  const [showFilters, setShowFilters] = useState(false);
  const [showAutotune, setShowAutotune] = useState(false);
  const [snapshot, setSnapshot] = useState<Map<string, number> | null>(null);
  const [autotuneActive, setAutotuneActive] = useState(false);
  const [autotuneLog, setAutotuneLog] = useState<string[]>([]);

  // Attitude ring buffer for live PID response graph
  const attitudeRing = useTelemetryStore((s) => s.attitude);
  const [tick, setTick] = useState(0);

  // Refresh graph at ~5Hz
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, []);

  const recentAttitude = useMemo(() => {
    const cutoff = Date.now() - 15_000; // last 15s
    return attitudeRing.toArray().filter((a) => a.timestamp >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, attitudeRing.length]);

  // Memoize param names — changes when vehicle type changes, triggering reload
  const paramNames = useMemo(() => {
    const axes = vehicleType === "copter" ? COPTER_AXES : PLANE_AXES;
    return [
      ...axes.flatMap((a) => a.params.map((p) => p.param)),
      ...ACRO_PARAMS.map((p) => p.param),
      ...(showFilters ? FILTER_PARAMS.map((p) => p.param) : []),
      ...(isPx4 ? ["MC_ROLLRATE_K", "MC_PITCHRATE_K", "MC_YAWRATE_K"] : []),
    ];
  }, [vehicleType, showFilters, isPx4]);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash, revertAll,
  } = usePanelParams({ paramNames, panelId: "pid", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Saved to flight controller", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Written to flash — persists after reboot", "success");
    else toast("Failed to write to flash", "error");
  }

  function handleRevert() {
    revertAll();
    toast("Reverted to FC values", "info");
  }

  // Snapshot current PIDs for comparison
  function snapshotCurrent() {
    setSnapshot(new Map(params));
    toast("PID snapshot saved for comparison", "info");
  }

  // Apply a preset profile
  function applyPreset(preset: PidPreset) {
    for (const [param, value] of Object.entries(preset.values)) {
      setLocalValue(param, value);
    }
    toast(`Applied "${preset.name}" preset — save to apply`, "info");
  }

  // Autotune trigger
  const triggerAutotune = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    setAutotuneActive(true);
    setAutotuneLog(["Starting autotune..."]);

    // Subscribe to status text for autotune progress
    const unsub = protocol.onStatusText(({ text }) => {
      setAutotuneLog((prev) => [...prev.slice(-19), text]);
    });

    try {
      const result = await protocol.setFlightMode("AUTOTUNE");
      if (result.success) {
        setAutotuneLog((prev) => [...prev, "Switched to AUTOTUNE mode — fly in open area"]);
      } else {
        setAutotuneLog((prev) => [...prev, `Failed to enter AUTOTUNE: ${result.message ?? "rejected"}`]);
        setAutotuneActive(false);
      }
    } catch {
      setAutotuneLog((prev) => [...prev, "Failed to set AUTOTUNE mode"]);
      setAutotuneActive(false);
    }

    // Cleanup subscription after 5 minutes max
    setTimeout(() => {
      unsub();
      setAutotuneActive(false);
    }, 300_000);

    return () => unsub();
  }, [getSelectedProtocol]);

  const subtitle = vehicleType === "copter"
    ? "ArduCopter rate PIDs — roll, pitch, yaw"
    : "ArduPlane roll, pitch, yaw servo PID gains";

  return (
    <ArmedLockOverlay>
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">
        <PanelHeader
          title="PID Tuning"
          subtitle={subtitle}
          icon={<SlidersHorizontal size={16} />}
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={connected}
          error={error}
        />

        {/* Vehicle type toggle */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border-default p-1 w-fit">
          <button
            onClick={() => setVehicleType("copter")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              vehicleType === "copter"
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            Copter
          </button>
          <button
            onClick={() => setVehicleType("plane")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              vehicleType === "plane"
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            Plane
          </button>
          {detectedVehicle && (
            <span className="text-[10px] text-text-tertiary ml-2">
              Detected: {detectedVehicle}
            </span>
          )}
        </div>

        {/* PID Tables per axis */}
        {activeAxes.map((axis) => (
          <PidAxisRow
            key={axis.axis}
            axis={axis}
            params={params}
            dirtyParams={dirtyParams}
            setLocalValue={setLocalValue}
            mapParamName={pn}
          />
        ))}

        {/* Acro Rate Params */}
        <div className="border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Acro Rates</h2>
          </div>
          <div className="space-y-3">
            {ACRO_PARAMS.map((pidP) => {
              const value = params.get(pidP.param) ?? 0;
              const isDirty = dirtyParams.has(pidP.param);
              return (
                <div key={pidP.param} className="grid grid-cols-[160px_1fr_80px] items-center gap-3">
                  <div>
                    <span className="text-xs font-mono text-text-secondary">{pidP.label}</span>
                    <ParamTooltip meta={paramMeta.get(pidP.param)}><span className="text-[9px] text-text-tertiary block cursor-default">{pn(pidP.param)}</span></ParamTooltip>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={pidP.min}
                      max={pidP.max}
                      step={pidP.step}
                      value={value}
                      onChange={(e) => setLocalValue(pidP.param, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
                      <span>{pidP.min}</span>
                      <span>{pidP.max} deg/s</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={pidP.min}
                    max={pidP.max}
                    step={pidP.step}
                    value={value}
                    onChange={(e) => setLocalValue(pidP.param, parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary text-right",
                      "focus:outline-none focus:border-accent-primary transition-colors",
                      isDirty ? "border-status-warning" : "border-border-default",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Preset Profiles ── */}
        {vehicleType === "copter" && (
          <div className="border border-border-default bg-bg-secondary p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-accent-primary" />
              <h2 className="text-sm font-medium text-text-primary">Preset Profiles</h2>
            </div>
            <div className="flex gap-2">
              {COPTER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex-1 border border-border-default px-3 py-2 text-xs hover:bg-bg-tertiary hover:border-accent-primary/50 cursor-pointer transition-colors"
                >
                  <span className="font-semibold text-text-primary block">{preset.name}</span>
                  <span className="text-[10px] text-text-tertiary">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter Settings (expandable) ── */}
        <div className="border border-border-default bg-bg-secondary">
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-2 w-full px-4 py-3 text-left cursor-pointer hover:bg-bg-tertiary/50"
          >
            <Filter size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Filter Settings</h2>
            <span className="text-[10px] text-text-tertiary ml-auto">{showFilters ? "\u25BE" : "\u25B8"}</span>
          </button>
          {showFilters && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-[10px] text-text-tertiary">
                INS gyro/accel low-pass filters and harmonic notch filter
              </p>
              {FILTER_PARAMS.map((fp) => {
                const value = params.get(fp.param) ?? 0;
                const isDirty = dirtyParams.has(fp.param);
                return (
                  <div key={fp.param} className="grid grid-cols-[180px_1fr_80px] items-center gap-3">
                    <div>
                      <span className="text-xs font-mono text-text-secondary">{fp.label}</span>
                      <ParamTooltip meta={paramMeta.get(fp.param)}><span className="text-[9px] text-text-tertiary block cursor-default">{pn(fp.param)}</span></ParamTooltip>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={fp.min}
                        max={fp.max}
                        step={fp.step}
                        value={value}
                        onChange={(e) => setLocalValue(fp.param, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
                        <span>{fp.min}</span>
                        <span>{fp.max}</span>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={fp.min}
                      max={fp.max}
                      step={fp.step}
                      value={value}
                      onChange={(e) => setLocalValue(fp.param, parseFloat(e.target.value) || 0)}
                      className={cn(
                        "w-full h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary text-right",
                        "focus:outline-none focus:border-accent-primary transition-colors",
                        isDirty ? "border-status-warning" : "border-border-default",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Autotune (expandable) ── */}
        {vehicleType === "copter" && (
          <div className="border border-border-default bg-bg-secondary">
            <button
              onClick={() => setShowAutotune((a) => !a)}
              className="flex items-center gap-2 w-full px-4 py-3 text-left cursor-pointer hover:bg-bg-tertiary/50"
            >
              <Play size={14} className="text-accent-primary" />
              <h2 className="text-sm font-medium text-text-primary">Autotune</h2>
              <span className="text-[10px] text-text-tertiary ml-auto">{showAutotune ? "\u25BE" : "\u25B8"}</span>
            </button>
            {showAutotune && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-text-tertiary">
                  Switches to AUTOTUNE flight mode. Vehicle must be airborne in a calm environment.
                  Fly in roll/pitch/yaw — the controller automatically adjusts PID gains.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant={autotuneActive ? "danger" : "secondary"}
                    size="sm"
                    icon={<Play size={12} />}
                    disabled={!connected || autotuneActive}
                    onClick={triggerAutotune}
                  >
                    {autotuneActive ? "Autotune Active..." : "Start Autotune"}
                  </Button>
                  {autotuneActive && (
                    <span className="text-[10px] text-status-warning animate-pulse">
                      Fly in open area — autotune in progress
                    </span>
                  )}
                </div>
                {autotuneLog.length > 0 && (
                  <div className="bg-bg-tertiary/50 border border-border-default p-2 max-h-32 overflow-y-auto">
                    {autotuneLog.map((line, i) => (
                      <div key={i} className="text-[10px] font-mono text-text-secondary">{line}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AI Analysis & Tuning (expandable) ── */}
        <PidAnalysisSection
          vehicleType={vehicleType}
          params={params}
          setLocalValue={setLocalValue}
          connected={connected}
        />

        {/* ── Live PID Response Graph ── */}
        <div className="border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Live Attitude Response</h2>
            <span className="text-[10px] text-text-tertiary ml-auto">
              {recentAttitude.length > 0 ? `${recentAttitude.length} pts, 15s window` : "No data"}
            </span>
          </div>
          {recentAttitude.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <BarChart3 size={20} className="text-text-tertiary mb-1" />
              <span className="text-[10px] text-text-tertiary">
                {connected ? "Waiting for attitude data..." : "Connect a drone to view live response"}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <PidResponseChart data={recentAttitude.map((a) => a.roll)} label="Roll" color="#3A82FF" />
              <PidResponseChart data={recentAttitude.map((a) => a.pitch)} label="Pitch" color="#22c55e" />
              <PidResponseChart data={recentAttitude.map((a) => a.yaw)} label="Yaw" color="#f59e0b" />
            </div>
          )}
        </div>

        {/* ── Before/After Comparison ── */}
        <div className="border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Copy size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Before / After</h2>
            <Button variant="ghost" size="sm" onClick={snapshotCurrent} className="ml-auto">
              Snapshot Current
            </Button>
          </div>
          {!snapshot ? (
            <p className="text-[10px] text-text-tertiary">
              Click &quot;Snapshot Current&quot; to save current PID values, then adjust — compare side-by-side.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-border-default text-text-tertiary">
                    <th className="text-left py-1 pr-3">Param</th>
                    <th className="text-right py-1 px-2">Before</th>
                    <th className="text-right py-1 px-2">Current</th>
                    <th className="text-right py-1 pl-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(snapshot.entries())
                    .filter(([name]) => {
                      const current = params.get(name) ?? 0;
                      const before = snapshot.get(name) ?? 0;
                      return current !== before;
                    })
                    .map(([name]) => {
                      const before = snapshot.get(name) ?? 0;
                      const current = params.get(name) ?? 0;
                      const delta = current - before;
                      return (
                        <tr key={name} className="border-b border-border-default/50">
                          <td className="py-0.5 pr-3 text-text-secondary"><ParamTooltip meta={paramMeta.get(name)}><span className="cursor-default">{pn(name)}</span></ParamTooltip></td>
                          <td className="py-0.5 px-2 text-right text-text-tertiary">{before.toFixed(4)}</td>
                          <td className="py-0.5 px-2 text-right text-text-primary">{current.toFixed(4)}</td>
                          <td className={cn(
                            "py-0.5 pl-2 text-right",
                            delta > 0 ? "text-status-success" : delta < 0 ? "text-status-error" : "text-text-tertiary",
                          )}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(4)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {Array.from(snapshot.entries()).every(([name]) => (params.get(name) ?? 0) === (snapshot.get(name) ?? 0)) && (
                <p className="text-[10px] text-text-tertiary text-center py-2">No changes from snapshot</p>
              )}
            </div>
          )}
        </div>

        {/* PX4 Gain Multipliers */}
        {isPx4 && hasLoaded && (
          <section className="border-t border-border-secondary pt-4 mt-4">
            <h3 className="text-sm font-medium text-text-secondary mb-3">PX4 Gain Multipliers</h3>
            <p className="text-xs text-text-tertiary mb-3">Overall rate controller gain scaling. Default 1.0. Reduce to dampen response.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["MC_ROLLRATE_K", "MC_PITCHRATE_K", "MC_YAWRATE_K"].map((param) => (
                <div key={param}>
                  <label className="text-xs text-text-secondary mb-1 block">{param.replace("MC_", "").replace("RATE_K", "")}</label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={5}
                    value={String(params.get(param) ?? 1.0)}
                    onChange={(e) => setLocalValue(param, Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Save / Revert */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={handleSave}
          >
            Save to Flight Controller
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<RotateCcw size={14} />}
            disabled={!hasDirty}
            onClick={handleRevert}
          >
            Revert
          </Button>
          {hasRamWrites && (
            <Button
              variant="secondary"
              size="lg"
              icon={<HardDrive size={14} />}
              onClick={handleFlash}
            >
              Write to Flash
            </Button>
          )}
          {!connected && (
            <span className="text-[10px] text-text-tertiary">Connect a drone to save parameters</span>
          )}
          {hasDirty && connected && (
            <span className="text-[10px] text-status-warning">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
    </ArmedLockOverlay>
  );
}
