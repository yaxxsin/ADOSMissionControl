"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { SlidersHorizontal, Save, RotateCcw, BarChart3, HardDrive } from "lucide-react";
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

type VehicleType = "copter" | "plane";

type ParamValues = Record<string, { value: number; original: number; dirty: boolean }>;

function buildDefaults(axes: AxisConfig[], includeAcro: boolean): ParamValues {
  const out: ParamValues = {};
  for (const axis of axes) {
    for (const p of axis.params) {
      out[p.param] = { value: 0, original: 0, dirty: false };
    }
  }
  if (includeAcro) {
    for (const p of ACRO_PARAMS) {
      out[p.param] = { value: 0, original: 0, dirty: false };
    }
  }
  return out;
}

export function PidTuningPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();

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

  const [params, setParams] = useState<ParamValues>(() => buildDefaults(activeAxes, true));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  const connected = !!getSelectedProtocol();
  const hasDirty = Object.values(params).some((p) => p.dirty);

  // When toggling vehicle type, rebuild params if not yet loaded
  const handleVehicleToggle = useCallback((type: VehicleType) => {
    setVehicleType(type);
    if (!loaded) {
      const axes = type === "copter" ? COPTER_AXES : PLANE_AXES;
      setParams(buildDefaults(axes, true));
    }
  }, [loaded]);

  const updateParam = useCallback((name: string, value: number) => {
    setParams((prev) => {
      const entry = prev[name];
      if (!entry) return prev;
      return {
        ...prev,
        [name]: { ...entry, value, dirty: value !== entry.original },
      };
    });
  }, []);

  const loadParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const axes = vehicleType === "copter" ? COPTER_AXES : PLANE_AXES;
    const updated = buildDefaults(axes, true);
    for (const axis of axes) {
      for (const p of axis.params) {
        try {
          const pv = await protocol.getParameter(p.param);
          updated[p.param] = { value: pv.value, original: pv.value, dirty: false };
        } catch {
          // not available
        }
      }
    }
    // Load acro params
    for (const p of ACRO_PARAMS) {
      try {
        const pv = await protocol.getParameter(p.param);
        updated[p.param] = { value: pv.value, original: pv.value, dirty: false };
      } catch {
        // not available
      }
    }
    setParams(updated);
    setLoaded(true);
    toast("Loaded PID parameters", "success");
  }, [getSelectedProtocol, vehicleType, toast]);

  const saveParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    setSaving(true);
    for (const [name, p] of Object.entries(params)) {
      if (!p.dirty) continue;
      try {
        await protocol.setParameter(name, p.value);
        setParams((prev) => ({
          ...prev,
          [name]: { ...prev[name], original: p.value, dirty: false },
        }));
      } catch {
        toast(`Failed to write ${name}`, "error");
      }
    }
    setShowCommitButton(true);
    setSaving(false);
    toast("Saved to flight controller", "success");
  }, [getSelectedProtocol, params, toast]);

  const commitToFlash = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    try {
      await protocol.commitParamsToFlash();
      setShowCommitButton(false);
      toast("Written to flash — persists after reboot", "success");
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [getSelectedProtocol, toast]);

  const revertParams = useCallback(() => {
    setParams((prev) => {
      const out = { ...prev };
      for (const [name, p] of Object.entries(out)) {
        out[name] = { ...p, value: p.original, dirty: false };
      }
      return out;
    });
    toast("Reverted to FC values", "info");
  }, [toast]);

  const subtitle = vehicleType === "copter"
    ? "ArduCopter rate PIDs — roll, pitch, yaw"
    : "ArduPlane roll, pitch, yaw servo PID gains";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">PID Tuning</h1>
            <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>
          </div>
          {connected && !loaded && (
            <Button variant="secondary" size="sm" onClick={loadParams}>
              Load from FC
            </Button>
          )}
        </div>

        {/* Vehicle type toggle */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border-default p-1 w-fit">
          <button
            onClick={() => handleVehicleToggle("copter")}
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
            onClick={() => handleVehicleToggle("plane")}
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
              {axis.params.map((p) => {
                const pv = params[p.param];
                if (!pv) return null;
                return (
                  <div key={p.param} className="grid grid-cols-[100px_1fr_80px] items-center gap-3">
                    <div>
                      <span className="text-xs font-mono text-text-secondary">{p.label}</span>
                      <span className="text-[9px] text-text-tertiary block">{p.param}</span>
                    </div>

                    {/* Slider */}
                    <div className="relative">
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={pv.value}
                        onChange={(e) => updateParam(p.param, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      {/* Marks */}
                      <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
                        <span>{p.min}</span>
                        <span>{p.max}</span>
                      </div>
                    </div>

                    {/* Numeric input */}
                    <input
                      type="number"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={pv.value}
                      onChange={(e) => updateParam(p.param, parseFloat(e.target.value) || 0)}
                      className={cn(
                        "w-full h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary text-right",
                        "focus:outline-none focus:border-accent-primary transition-colors",
                        pv.dirty ? "border-status-warning" : "border-border-default",
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
            {ACRO_PARAMS.map((p) => {
              const pv = params[p.param];
              if (!pv) return null;
              return (
                <div key={p.param} className="grid grid-cols-[160px_1fr_80px] items-center gap-3">
                  <div>
                    <span className="text-xs font-mono text-text-secondary">{p.label}</span>
                    <span className="text-[9px] text-text-tertiary block">{p.param}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={pv.value}
                      onChange={(e) => updateParam(p.param, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
                      <span>{p.min}</span>
                      <span>{p.max} deg/s</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={pv.value}
                    onChange={(e) => updateParam(p.param, parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary text-right",
                      "focus:outline-none focus:border-accent-primary transition-colors",
                      pv.dirty ? "border-status-warning" : "border-border-default",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Live PID Graph placeholder */}
        <div className="border border-border-default border-dashed bg-bg-secondary p-6">
          <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
            <BarChart3 size={24} className="text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Connect to view live PID response</span>
            <span className="text-[10px] text-text-tertiary">
              Real-time PID_TUNING graph — Phase 3
            </span>
          </div>
        </div>

        {/* Save / Revert */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={saveParams}
          >
            Save to Flight Controller
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<RotateCcw size={14} />}
            disabled={!hasDirty}
            onClick={revertParams}
          >
            Revert
          </Button>
          {showCommitButton && (
            <Button
              variant="secondary"
              size="lg"
              icon={<HardDrive size={14} />}
              onClick={commitToFlash}
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
