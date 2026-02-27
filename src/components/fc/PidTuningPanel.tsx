"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { PanelHeader } from "./PanelHeader";
import {
  SlidersHorizontal, Save, RotateCcw, BarChart3, HardDrive,
  Play, Copy, Zap, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PidParam {
  param: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface AxisConfig {
  axis: string;
  params: PidParam[];
}

// ── Plane PID axes (servo-rate controllers) ──────────────────

const PLANE_AXES: AxisConfig[] = [
  {
    axis: "Roll",
    params: [
      { param: "RLL2SRV_P", label: "P", min: 0, max: 5, step: 0.001 },
      { param: "RLL2SRV_I", label: "I", min: 0, max: 5, step: 0.001 },
      { param: "RLL2SRV_D", label: "D", min: 0, max: 5, step: 0.001 },
      { param: "RLL2SRV_IMAX", label: "IMAX", min: 0, max: 4500, step: 1 },
      { param: "RLL2SRV_FF", label: "FF", min: 0, max: 5, step: 0.001 },
    ],
  },
  {
    axis: "Pitch",
    params: [
      { param: "PTCH2SRV_P", label: "P", min: 0, max: 5, step: 0.001 },
      { param: "PTCH2SRV_I", label: "I", min: 0, max: 5, step: 0.001 },
      { param: "PTCH2SRV_D", label: "D", min: 0, max: 5, step: 0.001 },
      { param: "PTCH2SRV_IMAX", label: "IMAX", min: 0, max: 4500, step: 1 },
      { param: "PTCH2SRV_FF", label: "FF", min: 0, max: 5, step: 0.001 },
    ],
  },
  {
    axis: "Yaw",
    params: [
      { param: "YAW2SRV_SLIP", label: "SLIP", min: 0, max: 5, step: 0.001 },
      { param: "YAW2SRV_INT", label: "INT", min: 0, max: 5, step: 0.001 },
      { param: "YAW2SRV_DAMP", label: "DAMP", min: 0, max: 5, step: 0.001 },
      { param: "YAW2SRV_RLL", label: "RLL", min: 0, max: 5, step: 0.001 },
    ],
  },
];

// ── Copter rate PID axes (ATC_RAT_*) ─────────────────────────

const COPTER_AXES: AxisConfig[] = [
  {
    axis: "Roll Rate",
    params: [
      { param: "ATC_RAT_RLL_P", label: "P", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_RLL_I", label: "I", min: 0, max: 2, step: 0.001 },
      { param: "ATC_RAT_RLL_D", label: "D", min: 0, max: 0.2, step: 0.0001 },
      { param: "ATC_RAT_RLL_FF", label: "FF", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_RLL_FLTT", label: "FLTT", min: 0, max: 100, step: 1 },
      { param: "ATC_RAT_RLL_FLTD", label: "FLTD", min: 0, max: 100, step: 1 },
    ],
  },
  {
    axis: "Pitch Rate",
    params: [
      { param: "ATC_RAT_PIT_P", label: "P", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_PIT_I", label: "I", min: 0, max: 2, step: 0.001 },
      { param: "ATC_RAT_PIT_D", label: "D", min: 0, max: 0.2, step: 0.0001 },
      { param: "ATC_RAT_PIT_FF", label: "FF", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_PIT_FLTT", label: "FLTT", min: 0, max: 100, step: 1 },
      { param: "ATC_RAT_PIT_FLTD", label: "FLTD", min: 0, max: 100, step: 1 },
    ],
  },
  {
    axis: "Yaw Rate",
    params: [
      { param: "ATC_RAT_YAW_P", label: "P", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_YAW_I", label: "I", min: 0, max: 2, step: 0.001 },
      { param: "ATC_RAT_YAW_D", label: "D", min: 0, max: 0.2, step: 0.0001 },
      { param: "ATC_RAT_YAW_FF", label: "FF", min: 0, max: 1, step: 0.001 },
      { param: "ATC_RAT_YAW_FLTT", label: "FLTT", min: 0, max: 100, step: 1 },
      { param: "ATC_RAT_YAW_FLTD", label: "FLTD", min: 0, max: 100, step: 1 },
    ],
  },
];

// ── Shared acro rate params ──────────────────────────────────

const ACRO_PARAMS: PidParam[] = [
  { param: "ACRO_RP_RATE", label: "ACRO Roll/Pitch Rate", min: 0, max: 720, step: 1 },
  { param: "ACRO_Y_RATE", label: "ACRO Yaw Rate", min: 0, max: 720, step: 1 },
];

// ── Filter params (INS_*) ────────────────────────────────────

const FILTER_PARAMS: PidParam[] = [
  { param: "INS_GYRO_FILTER", label: "Gyro LPF (Hz)", min: 0, max: 256, step: 1 },
  { param: "INS_ACCEL_FILTER", label: "Accel LPF (Hz)", min: 0, max: 256, step: 1 },
  { param: "INS_HNTCH_ENABLE", label: "Notch Enable", min: 0, max: 1, step: 1 },
  { param: "INS_HNTCH_FREQ", label: "Notch Freq (Hz)", min: 10, max: 400, step: 1 },
  { param: "INS_HNTCH_BW", label: "Notch BW (Hz)", min: 5, max: 200, step: 1 },
  { param: "INS_HNTCH_ATT", label: "Notch Attenuation (dB)", min: 0, max: 50, step: 1 },
  { param: "INS_HNTCH_REF", label: "Notch Reference", min: 0, max: 1, step: 0.01 },
  { param: "INS_HNTCH_MODE", label: "Notch Mode", min: 0, max: 5, step: 1 },
];

// ── PID preset profiles ──────────────────────────────────────

interface PidPreset {
  name: string;
  description: string;
  values: Record<string, number>;
}

const COPTER_PRESETS: PidPreset[] = [
  {
    name: "Conservative",
    description: "Gentle response, good for first flights",
    values: {
      ATC_RAT_RLL_P: 0.05, ATC_RAT_RLL_I: 0.05, ATC_RAT_RLL_D: 0.002,
      ATC_RAT_PIT_P: 0.05, ATC_RAT_PIT_I: 0.05, ATC_RAT_PIT_D: 0.002,
      ATC_RAT_YAW_P: 0.15, ATC_RAT_YAW_I: 0.015, ATC_RAT_YAW_D: 0.0,
    },
  },
  {
    name: "Default",
    description: "ArduCopter defaults — balanced response",
    values: {
      ATC_RAT_RLL_P: 0.135, ATC_RAT_RLL_I: 0.135, ATC_RAT_RLL_D: 0.004,
      ATC_RAT_PIT_P: 0.135, ATC_RAT_PIT_I: 0.135, ATC_RAT_PIT_D: 0.004,
      ATC_RAT_YAW_P: 0.18, ATC_RAT_YAW_I: 0.018, ATC_RAT_YAW_D: 0.0,
    },
  },
  {
    name: "Aggressive",
    description: "Snappy response — experienced pilots only",
    values: {
      ATC_RAT_RLL_P: 0.25, ATC_RAT_RLL_I: 0.25, ATC_RAT_RLL_D: 0.008,
      ATC_RAT_PIT_P: 0.25, ATC_RAT_PIT_I: 0.25, ATC_RAT_PIT_D: 0.008,
      ATC_RAT_YAW_P: 0.3, ATC_RAT_YAW_I: 0.03, ATC_RAT_YAW_D: 0.0,
    },
  },
];

// ── Inline waveform chart (SVG) ──────────────────────────────

function PidResponseChart({
  data,
  label,
  color,
  height = 50,
}: {
  data: number[];
  label: string;
  color: string;
  height?: number;
}) {
  const width = 300;
  if (data.length < 2) return null;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - pad - ((v - minV) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono text-text-tertiary w-8">{label}</span>
      <svg viewBox={`0 0 ${width} ${height}`} className="flex-1 h-[50px] bg-bg-tertiary/30 rounded" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="text-[9px] font-mono text-text-tertiary w-12 text-right tabular-nums">
        {data[data.length - 1]?.toFixed(1)}°
      </span>
    </div>
  );
}

type VehicleType = "copter" | "plane";

export function PidTuningPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Detect vehicle type from connected drone
  const drone = getSelectedDrone();
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
    ];
  }, [vehicleType, showFilters]);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash, revertAll,
  } = usePanelParams({ paramNames, panelId: "pid" });

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
    <div className="flex-1 overflow-y-auto p-6">
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
          <div key={axis.axis} className="border border-border-default bg-bg-secondary p-4">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal size={14} className="text-accent-primary" />
              <h2 className="text-sm font-medium text-text-primary">{axis.axis}</h2>
            </div>

            <div className="space-y-3">
              {axis.params.map((pidP) => {
                const value = params.get(pidP.param) ?? 0;
                const isDirty = dirtyParams.has(pidP.param);
                return (
                  <div key={pidP.param} className="grid grid-cols-[100px_1fr_80px] items-center gap-3">
                    <div>
                      <span className="text-xs font-mono text-text-secondary">{pidP.label}</span>
                      <span className="text-[9px] text-text-tertiary block">{pidP.param}</span>
                    </div>

                    {/* Slider */}
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
                      {/* Marks */}
                      <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
                        <span>{pidP.min}</span>
                        <span>{pidP.max}</span>
                      </div>
                    </div>

                    {/* Numeric input */}
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
                    <span className="text-[9px] text-text-tertiary block">{pidP.param}</span>
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
            <span className="text-[10px] text-text-tertiary ml-auto">{showFilters ? "▾" : "▸"}</span>
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
                      <span className="text-[9px] text-text-tertiary block">{fp.param}</span>
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
              <span className="text-[10px] text-text-tertiary ml-auto">{showAutotune ? "▾" : "▸"}</span>
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
              Click "Snapshot Current" to save current PID values, then adjust — compare side-by-side.
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
                          <td className="py-0.5 pr-3 text-text-secondary">{name}</td>
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
  );
}
