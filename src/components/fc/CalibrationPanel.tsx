"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  CalibrationWizard,
  type CalibrationStatus,
  type CompassProgressEntry,
  type CompassResultEntry,
} from "./CalibrationWizard";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalibrationRebootBanner } from "./CalibrationRebootBanner";
import { CalibrationLog } from "./CalibrationLog";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { useDiagnosticsStore } from "@/stores/diagnostics-store";
import {
  type CompassResult,
  type CalibrationState,
  type CalibrationLogEntry,
  INITIAL_STATE,
  ACCEL_STEPS, GYRO_STEPS, COMPASS_STEPS, LEVEL_STEPS,
  AIRSPEED_STEPS, BARO_STEPS, RC_CAL_STEPS, ESC_CAL_STEPS, COMPASSMOT_STEPS,
  TYPE_KEYWORDS, MAG_CAL_FAIL_MESSAGES, LOG_KEYWORDS,
  CAL_TIMEOUTS, MAX_LOG_ENTRIES,
} from "./calibration-types";
import { RcChannelMapSection } from "./RcChannelMapSection";
import { GpsConfigSection } from "./GpsConfigSection";
import { ServoCalibrationSection } from "./ServoCalibrationSection";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";

// ── RC Calibration Constants ─────────────────────────────

const RC_CHANNEL_COUNT = 8;
const RC_CHANNEL_LABELS = ["Roll", "Pitch", "Throttle", "Yaw", "Aux 1", "Aux 2", "Aux 3", "Aux 4"];
const RC_PWM_MIN = 800;
const RC_PWM_MAX = 2200;
const RC_CENTER_TOLERANCE = 100; // ±100 from 1500 is considered "centered"
const RC_CENTER_VALUE = 1500;

// ── Calibration snapshot params (before/after comparison) ──
const CAL_SNAPSHOT_PARAMS: Record<string, string[]> = {
  accel: ["INS_ACCOFFS_X", "INS_ACCOFFS_Y", "INS_ACCOFFS_Z", "INS_ACCSCAL_X", "INS_ACCSCAL_Y", "INS_ACCSCAL_Z"],
  gyro: ["INS_GYROFFS_X", "INS_GYROFFS_Y", "INS_GYROFFS_Z"],
  compass: ["COMPASS_OFS_X", "COMPASS_OFS_Y", "COMPASS_OFS_Z", "COMPASS_DIA_X", "COMPASS_DIA_Y", "COMPASS_DIA_Z"],
  level: ["AHRS_TRIM_X", "AHRS_TRIM_Y", "AHRS_TRIM_Z"],
  baro: ["GND_ABS_PRESS", "GND_TEMP"],
  airspeed: ["ARSPD_OFFSET"],
};

type RcCalStep = "idle" | "center" | "move" | "confirm" | "saving" | "done" | "error";

interface RcChannelCapture {
  min: number;
  max: number;
  trim: number;
}

function defaultCapture(): RcChannelCapture {
  return { min: RC_PWM_MAX, max: RC_PWM_MIN, trim: RC_CENTER_VALUE };
}

// ── RC Channel Bar ──────────────────────────────────────

function RcChannelBar({
  label,
  channel,
  value,
  capturedMin,
  capturedMax,
  capturedTrim,
  showCaptures,
}: {
  label: string;
  channel: number;
  value: number;
  capturedMin: number;
  capturedMax: number;
  capturedTrim: number;
  showCaptures: boolean;
}) {
  const range = RC_PWM_MAX - RC_PWM_MIN;
  const pct = ((value - RC_PWM_MIN) / range) * 100;
  const minPct = ((capturedMin - RC_PWM_MIN) / range) * 100;
  const maxPct = ((capturedMax - RC_PWM_MIN) / range) * 100;
  const trimPct = ((capturedTrim - RC_PWM_MIN) / range) * 100;

  const barColor = value < 1000 || value > 2000
    ? "bg-status-warning"
    : "bg-accent-primary";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-text-secondary w-16 shrink-0">
        CH{channel} <span className="text-text-tertiary">{label}</span>
      </span>
      <div className="relative h-4 bg-bg-tertiary flex-1">
        {/* Fill bar from left to current value */}
        <div
          className={cn("absolute top-0 left-0 h-full transition-all duration-100", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
        {/* Captured markers */}
        {showCaptures && capturedMin < RC_PWM_MAX && (
          <div
            className="absolute top-0 h-full w-[2px] bg-status-error"
            style={{ left: `${Math.min(100, Math.max(0, minPct))}%` }}
            title={`Min: ${capturedMin}`}
          />
        )}
        {showCaptures && capturedMax > RC_PWM_MIN && (
          <div
            className="absolute top-0 h-full w-[2px] bg-status-error"
            style={{ left: `${Math.min(100, Math.max(0, maxPct))}%` }}
            title={`Max: ${capturedMax}`}
          />
        )}
        {showCaptures && (
          <div
            className="absolute top-0 h-full w-[2px] bg-status-success"
            style={{ left: `${Math.min(100, Math.max(0, trimPct))}%` }}
            title={`Trim: ${capturedTrim}`}
          />
        )}
      </div>
      <span className="text-[10px] font-mono text-text-tertiary w-10 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ── RC Calibration Wizard Component ─────────────────────

function RcCalibrationWizard({ connected }: { connected: boolean }) {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const telVersion = useTelemetryStore((s) => s._version);
  const { toast } = useToast();

  const [step, setStep] = useState<RcCalStep>("idle");
  const [captures, setCaptures] = useState<RcChannelCapture[]>(() =>
    Array.from({ length: RC_CHANNEL_COUNT }, defaultCapture)
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [showTrimReset, setShowTrimReset] = useState(false);
  const [trimResetting, setTrimResetting] = useState(false);
  const capturesRef = useRef(captures);
  capturesRef.current = captures;

  // Get latest RC channel values from telemetry ring buffer
  const latestRc = useMemo(() => {
    const latest = rcBuffer.latest();
    return latest?.channels ?? Array(16).fill(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcBuffer, telVersion]);

  // Track min/max during "move" step
  useEffect(() => {
    if (step !== "move") return;
    setCaptures((prev) => {
      const next = [...prev];
      let changed = false;
      for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
        const val = latestRc[i] ?? 0;
        if (val === 0) continue; // no data
        const ch = { ...next[i] };
        if (val < ch.min) { ch.min = val; changed = true; }
        if (val > ch.max) { ch.max = val; changed = true; }
        next[i] = ch;
      }
      return changed ? next : prev;
    });
  }, [step, latestRc]);

  const handleStart = useCallback(() => {
    setStep("center");
    setCaptures(Array.from({ length: RC_CHANNEL_COUNT }, defaultCapture));
    setErrorMsg("");
  }, []);

  const handleCenterConfirm = useCallback(() => {
    // Validate channels are near center
    const offCenter: number[] = [];
    for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
      const val = latestRc[i] ?? 0;
      if (val === 0) continue;
      if (Math.abs(val - RC_CENTER_VALUE) > RC_CENTER_TOLERANCE) {
        offCenter.push(i + 1);
      }
    }
    if (offCenter.length > 0 && latestRc[0] !== 0) {
      toast(`Channels ${offCenter.join(", ")} not centered. Center all sticks and try again.`, "error");
      return;
    }
    // Capture trim values from current position
    setCaptures((prev) => {
      const next = [...prev];
      for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
        const val = latestRc[i] ?? RC_CENTER_VALUE;
        if (val === 0) continue;
        next[i] = { ...next[i], trim: val };
      }
      return next;
    });
    setStep("move");
  }, [latestRc, toast]);

  const handleMoveComplete = useCallback(() => {
    // Validate that we captured some reasonable range for the first 4 channels
    const caps = capturesRef.current;
    const narrow: number[] = [];
    for (let i = 0; i < 4; i++) {
      const range = caps[i].max - caps[i].min;
      if (range < 200) {
        narrow.push(i + 1);
      }
    }
    if (narrow.length > 0) {
      toast(`Channels ${narrow.join(", ")} have narrow range (<200). Move sticks to full extent.`, "error");
      return;
    }
    setStep("confirm");
  }, [toast]);

  const handleSave = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    setStep("saving");
    try {
      // Write RC params via protocol
      for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
        const ch = capturesRef.current[i];
        const idx = i + 1;
        await protocol.setParameter(`RC${idx}_MIN`, ch.min);
        await protocol.setParameter(`RC${idx}_MAX`, ch.max);
        await protocol.setParameter(`RC${idx}_TRIM`, ch.trim);
      }
      // Commit to flash
      await protocol.commitParamsToFlash();
      setStep("done");
      toast("RC calibration saved to flash", "success");
    } catch {
      setStep("error");
      setErrorMsg("Failed to write RC parameters");
      toast("Failed to write RC parameters", "error");
    }
  }, [getSelectedProtocol, toast]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setCaptures(Array.from({ length: RC_CHANNEL_COUNT }, defaultCapture));
    setErrorMsg("");
  }, []);

  const handleResetTrims = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    setTrimResetting(true);
    try {
      for (let i = 1; i <= RC_CHANNEL_COUNT; i++) {
        await protocol.setParameter(`RC${i}_TRIM`, RC_CENTER_VALUE);
      }
      await protocol.commitParamsToFlash();
      toast("RC trims reset to 1500 and saved to flash", "success");
    } catch {
      toast("Failed to reset RC trims", "error");
    } finally {
      setTrimResetting(false);
      setShowTrimReset(false);
    }
  }, [getSelectedProtocol, toast]);

  const statusBadge = {
    idle: { label: "Ready", className: "bg-bg-tertiary text-text-tertiary" },
    center: { label: "Step 1/3", className: "bg-accent-primary/20 text-accent-primary" },
    move: { label: "Step 2/3", className: "bg-accent-primary/20 text-accent-primary" },
    confirm: { label: "Step 3/3", className: "bg-status-warning/20 text-status-warning" },
    saving: { label: "Saving", className: "bg-accent-primary/20 text-accent-primary" },
    done: { label: "Complete", className: "bg-status-success/20 text-status-success" },
    error: { label: "Failed", className: "bg-status-error/20 text-status-error" },
  } as const;

  const badge = statusBadge[step];
  const showCaptures = step === "move" || step === "confirm" || step === "done";

  return (
    <div className="border border-border-default bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Radio Calibration</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Calibrate RC transmitter stick endpoints and trims. Move all sticks and switches to full extent.
          </p>
        </div>
        <span className={cn("text-[10px] font-mono px-2 py-0.5 shrink-0", badge.className)}>
          {badge.label}
        </span>
      </div>

      {/* Pre-calibration tips */}
      {step === "idle" && (
        <div className="mb-4 bg-bg-tertiary/50 px-3 py-2.5">
          <p className="text-[10px] font-medium text-text-secondary mb-1.5">Before you start</p>
          <ol className="space-y-1">
            <li className="text-[10px] text-text-tertiary flex gap-1.5">
              <span className="text-text-secondary shrink-0">1.</span>
              Turn on RC transmitter and verify binding before starting
            </li>
            <li className="text-[10px] text-text-tertiary flex gap-1.5">
              <span className="text-text-secondary shrink-0">2.</span>
              Ensure all trims on transmitter are centered (no sub-trim)
            </li>
            <li className="text-[10px] text-text-tertiary flex gap-1.5">
              <span className="text-text-secondary shrink-0">3.</span>
              You will need to move ALL sticks and switches to their extremes
            </li>
          </ol>
        </div>
      )}

      {/* Step instructions */}
      {step === "center" && (
        <div className="mb-3 border border-accent-primary/20 bg-accent-primary/5 px-3 py-2.5">
          <p className="text-[10px] font-medium text-accent-primary">Step 1/3: {RC_CAL_STEPS[0].label}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">
            {RC_CAL_STEPS[0].description}
          </p>
        </div>
      )}
      {step === "move" && (
        <div className="mb-3 border border-accent-primary/20 bg-accent-primary/5 px-3 py-2.5">
          <p className="text-[10px] font-medium text-accent-primary">Step 2/3: {RC_CAL_STEPS[1].label}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">
            {RC_CAL_STEPS[1].description}
          </p>
        </div>
      )}
      {step === "confirm" && (
        <div className="mb-3 border border-status-warning/20 bg-status-warning/5 px-3 py-2.5">
          <p className="text-[10px] font-medium text-status-warning">Step 3/3: {RC_CAL_STEPS[2].label}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">
            {RC_CAL_STEPS[2].description} Click Save to write RC parameters.
          </p>
        </div>
      )}

      {/* Channel bars — visible during all active steps */}
      {step !== "idle" && (
        <div className="mb-4 space-y-1.5">
          {Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => (
            <RcChannelBar
              key={i}
              label={RC_CHANNEL_LABELS[i]}
              channel={i + 1}
              value={latestRc[i] ?? 0}
              capturedMin={captures[i].min}
              capturedMax={captures[i].max}
              capturedTrim={captures[i].trim}
              showCaptures={showCaptures}
            />
          ))}
        </div>
      )}

      {/* Summary table in confirm/done state */}
      {(step === "confirm" || step === "done") && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-text-tertiary">
                <th className="text-left px-1 py-0.5">CH</th>
                <th className="text-right px-1 py-0.5">Min</th>
                <th className="text-right px-1 py-0.5">Trim</th>
                <th className="text-right px-1 py-0.5">Max</th>
                <th className="text-right px-1 py-0.5">Range</th>
              </tr>
            </thead>
            <tbody>
              {captures.map((ch, i) => {
                const range = ch.max - ch.min;
                const rangeOk = range >= 200;
                return (
                  <tr key={i} className="border-t border-border-default/50">
                    <td className="text-left px-1 py-0.5 text-text-secondary">
                      CH{i + 1} {RC_CHANNEL_LABELS[i]}
                    </td>
                    <td className="text-right px-1 py-0.5 text-text-primary">{ch.min}</td>
                    <td className="text-right px-1 py-0.5 text-status-success">{ch.trim}</td>
                    <td className="text-right px-1 py-0.5 text-text-primary">{ch.max}</td>
                    <td className={cn("text-right px-1 py-0.5", rangeOk ? "text-status-success" : "text-status-warning")}>
                      {range}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Status messages */}
      {step === "done" && (
        <p className="text-[10px] font-mono text-status-success mb-3">
          RC calibration complete. Parameters saved to flash.
        </p>
      )}
      {step === "error" && (
        <p className="text-[10px] font-mono text-status-error mb-3">
          {errorMsg}
        </p>
      )}
      {step === "saving" && (
        <p className="text-[10px] font-mono text-text-tertiary mb-3">
          Writing RC parameters to flight controller...
        </p>
      )}

      {/* Trim Reset Confirmation */}
      {showTrimReset && (
        <div className="mb-3 border border-status-warning/30 bg-status-warning/5 px-3 py-2.5">
          <p className="text-[10px] font-medium text-status-warning mb-1.5">Confirm Trim Reset</p>
          <p className="text-[10px] text-text-tertiary mb-2">
            This will set RC1_TRIM through RC8_TRIM to 1500 (center). This affects flight behavior and should only be done if trims are incorrect.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={handleResetTrims} loading={trimResetting} disabled={trimResetting}>
              Reset All Trims
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTrimReset(false)} disabled={trimResetting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {step === "idle" && (
          <>
            <Button variant="primary" size="sm" onClick={handleStart} disabled={!connected}>
              Start
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTrimReset(true)} disabled={!connected || showTrimReset}>
              Reset Trims
            </Button>
          </>
        )}
        {step === "center" && (
          <>
            <Button variant="primary" size="sm" onClick={handleCenterConfirm}>
              Next
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        )}
        {step === "move" && (
          <>
            <Button variant="primary" size="sm" onClick={handleMoveComplete}>
              Next
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        )}
        {step === "confirm" && (
          <>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        )}
        {step === "saving" && (
          <Button variant="secondary" size="sm" loading disabled>
            Saving...
          </Button>
        )}
        {(step === "done" || step === "error") && (
          <Button variant="primary" size="sm" onClick={handleStart}>
            {step === "done" ? "Re-calibrate" : "Retry"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const connected = !!getSelectedProtocol();
  const { firmwareType } = useFirmwareCapabilities();
  const isPx4 = firmwareType === "px4";

  const [accel, setAccel] = useState<CalibrationState>(INITIAL_STATE);
  const [gyro, setGyro] = useState<CalibrationState>(INITIAL_STATE);
  const [compass, setCompass] = useState<CalibrationState>(INITIAL_STATE);
  const [level, setLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [airspeed, setAirspeed] = useState<CalibrationState>(INITIAL_STATE);
  const [baro, setBaro] = useState<CalibrationState>(INITIAL_STATE);
  const [esc, setEsc] = useState<CalibrationState>(INITIAL_STATE);
  const [compassmot, setCompassmot] = useState<CalibrationState>(INITIAL_STATE);
  const [logEntries, setLogEntries] = useState<CalibrationLogEntry[]>([]);

  // PX4 calibration STATUSTEXT state
  const [px4CalProgress, setPx4CalProgress] = useState(0);
  const [px4CalStatus, setPx4CalStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [px4CalCompletedSides, setPx4CalCompletedSides] = useState<Set<number>>(new Set());
  const [px4CalActiveType, setPx4CalActiveType] = useState<string | null>(null);
  const px4CalActiveTypeRef = useRef<string | null>(null);
  const px4CalCompletedSidesRef = useRef<Set<number>>(new Set());
  useEffect(() => { px4CalActiveTypeRef.current = px4CalActiveType; }, [px4CalActiveType]);
  useEffect(() => { px4CalCompletedSidesRef.current = px4CalCompletedSides; }, [px4CalCompletedSides]);

  // PX4-only calibration states (Quick Level, GNSS Mag Cal)
  const [px4QuickLevel, setPx4QuickLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [px4GnssMagCal, setPx4GnssMagCal] = useState<CalibrationState>(INITIAL_STATE);

  // Baro live pressure display (SCALED_PRESSURE msg 29)
  const [baroPressure, setBaroPressure] = useState<{ pressAbs: number; temperature: number } | null>(null);

  // Calibration before/after comparison
  const [calSnapshot, setCalSnapshot] = useState<Map<string, number> | null>(null);
  const [calDiff, setCalDiff] = useState<Array<{ name: string; before: number; after: number }> | null>(null);
  const [calDiffType, setCalDiffType] = useState<string | null>(null);

  const [compassParams, setCompassParams] = useState<{
    COMPASS_USE: number | null;
    COMPASS_ORIENT: number | null;
    COMPASS_AUTO_ROT: number | null;
    COMPASS_OFFS_MAX: number | null;
    COMPASS_LEARN: number | null;
    COMPASS_EXTERNAL: number | null;
  }>({ COMPASS_USE: null, COMPASS_ORIENT: null, COMPASS_AUTO_ROT: null, COMPASS_OFFS_MAX: null, COMPASS_LEARN: null, COMPASS_EXTERNAL: null });

  // Per-type subscription map
  const subsRef = useRef<Map<string, (() => void)[]>>(new Map());
  // Track timeout IDs separately for resetting
  const timeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function addSub(type: string, unsub: () => void) {
    if (!subsRef.current.has(type)) subsRef.current.set(type, []);
    subsRef.current.get(type)!.push(unsub);
  }

  function cleanupSubs(type: string) {
    subsRef.current.get(type)?.forEach((unsub) => unsub());
    subsRef.current.delete(type);
    timeoutRef.current.delete(type);
  }

  function resetTimeout(type: string, setter: React.Dispatch<React.SetStateAction<CalibrationState>>, duration?: number) {
    const old = timeoutRef.current.get(type);
    if (old) clearTimeout(old);
    const ms = duration ?? CAL_TIMEOUTS[type] ?? 60_000;
    const newTimeout = setTimeout(() => {
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        cleanupSubs(type);
        useDiagnosticsStore.getState().logCalibration(type, "failed");
        return { ...prev, status: "error", message: "Calibration timed out — no response from flight controller" };
      });
    }, ms);
    timeoutRef.current.set(type, newTimeout);
    addSub(type, () => clearTimeout(newTimeout));
  }

  // Global log subscription — subscribe to all calibration-related STATUSTEXT
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    const unsub = protocol.onStatusText(({ severity, text }) => {
      const lower = text.toLowerCase();
      if (LOG_KEYWORDS.some((kw) => lower.includes(kw))) {
        setLogEntries((prev) => {
          const next = [...prev, { timestamp: Date.now(), text, severity }];
          return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
        });
      }
    });

    return unsub;
  }, [getSelectedProtocol]);

  // PX4 calibration STATUSTEXT parser — parse [cal] messages for progress
  useEffect(() => {
    if (!isPx4) return;
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    const unsub = protocol.onStatusText(({ text }) => {
      if (!text.startsWith("[cal]")) return;

      // Progress percentage: [cal] progress <NN>
      const progressMatch = text.match(/\[cal\] progress <(\d+)>/);
      if (progressMatch) {
        const pct = parseInt(progressMatch[1], 10);
        setPx4CalProgress(pct);
        // Also route progress into the active calibration setter
        if (px4CalActiveTypeRef.current === "accel") {
          setAccel((prev) => prev.status === "in_progress" ? { ...prev, progress: pct, message: `PX4 calibration: ${pct}%` } : prev);
        } else if (px4CalActiveTypeRef.current === "compass") {
          setCompass((prev) => prev.status === "in_progress" ? { ...prev, progress: pct, message: `PX4 compass calibration: ${pct}%` } : prev);
        } else if (px4CalActiveTypeRef.current === "gyro") {
          setGyro((prev) => prev.status === "in_progress" ? { ...prev, progress: pct, message: `PX4 gyro calibration: ${pct}%` } : prev);
        } else if (px4CalActiveTypeRef.current === "level") {
          setLevel((prev) => prev.status === "in_progress" ? { ...prev, progress: pct, message: `PX4 level calibration: ${pct}%` } : prev);
        } else if (px4CalActiveTypeRef.current === "quick-level") {
          setPx4QuickLevel((prev) => prev.status === "in_progress" ? { ...prev, progress: pct, message: `Quick level: ${pct}%` } : prev);
        }
        return;
      }

      // Side completion: [cal] front side done, rotate to a different side
      const sideMatch = text.match(/\[cal\] (\w+) side done/);
      if (sideMatch) {
        // Map PX4 side names to accel position indices (1-based, matching ACCEL_STEPS)
        const sideMap: Record<string, number> = {
          back: 1, front: 2, left: 3, right: 4, up: 5, down: 6,
        };
        const pos = sideMap[sideMatch[1].toLowerCase()];
        if (pos) {
          setPx4CalCompletedSides((prev) => new Set([...prev, pos]));
          // Update accel step if running accel cal
          if (px4CalActiveTypeRef.current === "accel") {
            setAccel((prev) => {
              if (prev.status !== "in_progress") return prev;
              const completedCount = new Set([...px4CalCompletedSidesRef.current, pos]).size;
              return {
                ...prev,
                currentStep: completedCount,
                progress: (completedCount / ACCEL_STEPS.length) * 100,
                message: `${sideMatch[1]} side done. Rotate to a different side.`,
                waitingForConfirm: false,
              };
            });
          }
        }
        return;
      }

      // Orientation detected: [cal] orientation detected: front
      const orientMatch = text.match(/\[cal\] orientation detected: (\w+)/);
      if (orientMatch) {
        if (px4CalActiveTypeRef.current === "accel") {
          const sideNameMap: Record<string, number> = {
            back: 0, front: 1, left: 2, right: 3, up: 4, down: 5,
          };
          const stepIdx = sideNameMap[orientMatch[1].toLowerCase()];
          if (stepIdx !== undefined) {
            setAccel((prev) => prev.status === "in_progress" ? {
              ...prev,
              currentStep: stepIdx,
              message: `Detected: ${orientMatch[1]}. Hold still...`,
            } : prev);
          }
        }
        return;
      }

      // Calibration done: [cal] calibration done: <param>
      if (text.includes("calibration done")) {
        setPx4CalProgress(100);
        setPx4CalStatus("success");
        // Route success to the active calibration state
        const calTypeSetter = px4CalActiveTypeRef.current === "accel" ? setAccel
          : px4CalActiveTypeRef.current === "compass" ? setCompass
          : px4CalActiveTypeRef.current === "gyro" ? setGyro
          : px4CalActiveTypeRef.current === "level" ? setLevel
          : px4CalActiveTypeRef.current === "quick-level" ? setPx4QuickLevel
          : px4CalActiveTypeRef.current === "gnss-mag" ? setPx4GnssMagCal
          : null;
        if (calTypeSetter) {
          calTypeSetter((prev) => {
            if (prev.status !== "in_progress") return prev;
            return {
              ...INITIAL_STATE,
              status: "success",
              progress: 100,
              message: text,
              needsReboot: ["accel", "compass", "level"].includes(px4CalActiveTypeRef.current ?? ""),
            };
          });
        }
        const label = px4CalActiveTypeRef.current ?? "PX4";
        toast(`${label.charAt(0).toUpperCase() + label.slice(1)} calibration complete`, "success");
        useDiagnosticsStore.getState().logCalibration(px4CalActiveTypeRef.current ?? "px4", "success");
        setPx4CalActiveType(null);
        return;
      }

      // Calibration failed: [cal] calibration failed: <reason>
      if (text.includes("calibration failed")) {
        setPx4CalStatus("failed");
        const calTypeSetter = px4CalActiveTypeRef.current === "accel" ? setAccel
          : px4CalActiveTypeRef.current === "compass" ? setCompass
          : px4CalActiveTypeRef.current === "gyro" ? setGyro
          : px4CalActiveTypeRef.current === "level" ? setLevel
          : px4CalActiveTypeRef.current === "quick-level" ? setPx4QuickLevel
          : px4CalActiveTypeRef.current === "gnss-mag" ? setPx4GnssMagCal
          : null;
        if (calTypeSetter) {
          calTypeSetter((prev) => ({
            ...prev,
            status: "error",
            message: text,
            waitingForConfirm: false,
          }));
        }
        const label = px4CalActiveTypeRef.current ?? "PX4";
        toast(`${label.charAt(0).toUpperCase() + label.slice(1)} calibration failed`, "error");
        useDiagnosticsStore.getState().logCalibration(px4CalActiveTypeRef.current ?? "px4", "failed");
        setPx4CalActiveType(null);
        return;
      }

      // Calibration started: [cal] calibration started: <type_id>
      if (text.includes("calibration started")) {
        setPx4CalProgress(0);
        setPx4CalStatus("running");
        setPx4CalCompletedSides(new Set());
        return;
      }
    });

    return unsub;
  }, [isPx4, getSelectedProtocol, toast]);

  // Fetch compass params for pre-calibration checks
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const names = ["COMPASS_USE", "COMPASS_ORIENT", "COMPASS_AUTO_ROT", "COMPASS_OFFS_MAX", "COMPASS_LEARN", "COMPASS_EXTERNAL"] as const;
    Promise.allSettled(names.map((n) => protocol.getParameter(n))).then((results) => {
      const vals: Record<string, number | null> = {};
      names.forEach((n, i) => {
        const r = results[i];
        vals[n] = r.status === "fulfilled" ? r.value.value : null;
      });
      setCompassParams({
        COMPASS_USE: vals.COMPASS_USE ?? null,
        COMPASS_ORIENT: vals.COMPASS_ORIENT ?? null,
        COMPASS_AUTO_ROT: vals.COMPASS_AUTO_ROT ?? null,
        COMPASS_OFFS_MAX: vals.COMPASS_OFFS_MAX ?? null,
        COMPASS_LEARN: vals.COMPASS_LEARN ?? null,
        COMPASS_EXTERNAL: vals.COMPASS_EXTERNAL ?? null,
      });
    });
  }, [getSelectedProtocol]);

  // Subscribe to SCALED_PRESSURE for live baro display
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol?.onScaledPressure) return;
    const unsub = protocol.onScaledPressure(({ pressAbs, temperature }) => {
      setBaroPressure({ pressAbs, temperature });
    });
    return unsub;
  }, [getSelectedProtocol]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const type of subsRef.current.keys()) {
        cleanupSubs(type);
      }
    };
  }, []);

  // Fetch calibration-relevant params and build a before/after diff
  const fetchCalDiff = useCallback(async (type: string, snapshot: Map<string, number>) => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const paramNames = CAL_SNAPSHOT_PARAMS[type];
    if (!paramNames || paramNames.length === 0) return;

    const results = await Promise.allSettled(paramNames.map((n) => protocol.getParameter(n)));
    const diffs: Array<{ name: string; before: number; after: number }> = [];
    paramNames.forEach((name, i) => {
      const r = results[i];
      if (r.status !== "fulfilled") return;
      const after = r.value.value;
      const before = snapshot.get(name);
      if (before !== undefined && before !== after) {
        diffs.push({ name, before, after });
      }
    });
    if (diffs.length > 0) {
      setCalDiff(diffs);
      setCalDiffType(type);
    }
  }, [getSelectedProtocol]);

  // Detect calibration success and fetch before/after diff
  const calStates = useMemo(() => [
    { type: "accel", state: accel },
    { type: "gyro", state: gyro },
    { type: "compass", state: compass },
    { type: "level", state: level },
    { type: "airspeed", state: airspeed },
    { type: "baro", state: baro },
  ], [accel, gyro, compass, level, airspeed, baro]);

  const lastSuccessRef = useRef<string | null>(null);
  useEffect(() => {
    const succeeded = calStates.find((c) => c.state.status === "success");
    if (succeeded && succeeded.type !== lastSuccessRef.current && calSnapshot) {
      lastSuccessRef.current = succeeded.type;
      // Delay fetch slightly so FC can finalize params
      const timer = setTimeout(() => {
        fetchCalDiff(succeeded.type, calSnapshot);
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (!succeeded) lastSuccessRef.current = null;
  }, [calStates, calSnapshot, fetchCalDiff]);

  // Keyboard handler for accel cal confirm
  useEffect(() => {
    if (!accel.waitingForConfirm) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore modifier-only presses
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      confirmAccelPosition();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accel.waitingForConfirm, accel.accelCalPosition]);

  const confirmAccelPosition = useCallback(() => {
    const protocol = getSelectedProtocol();
    if (!protocol?.confirmAccelCalPos || accel.accelCalPosition === null) return;
    protocol.confirmAccelCalPos(accel.accelCalPosition);
    setAccel((prev) => ({ ...prev, waitingForConfirm: false }));
  }, [getSelectedProtocol, accel.accelCalPosition]);

  const subscribeToStatus = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
      calType: string,
    ) => {
      cleanupSubs(calType);
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      const keywords = TYPE_KEYWORDS[calType] ?? [];

      // Initial timeout — uses per-type duration from CAL_TIMEOUTS
      resetTimeout(calType, setter);

      const statusUnsub = protocol.onStatusText(({ text }) => {
        const lower = text.toLowerCase();

        const typeRelevant =
          keywords.some((kw) => lower.includes(kw)) || lower.includes(calType);

        // Detect completion — covers ArduPilot-specific phrasing
        const isSuccessMessage =
          lower.includes("calibration successful") ||
          lower.includes("calibration done") ||
          lower.includes("calibration complete") ||
          (lower.includes("calibrated") && lower.includes("requires reboot")) ||
          lower.includes("trim ok") ||
          lower.includes("trim saved") ||
          lower.includes("cal done") ||
          lower.includes("offsets saved") ||
          lower.includes("offsets complete") ||
          lower.includes("cal complete");

        if (isSuccessMessage) {
          // Only accept success messages that are relevant to this calibration type — no generic fallback
          if (!typeRelevant) return;
          if (calType === "compass") {
            // Compass success comes from MAG_CAL_REPORT, not STATUSTEXT.
            // With param3=0, MAG_CAL_REPORT provides offsets and triggers waiting_accept.
            setter((prev) => ({ ...prev, message: text }));
            return;
          }
          const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
          setter((prev) => {
            if (prev.status !== "in_progress") return prev;
            return {
              ...INITIAL_STATE,
              status: "success",
              currentStep: stepCount,
              progress: 100,
              message: text,
              needsReboot: rebootTypes.includes(calType),
            };
          });
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
          useDiagnosticsStore.getState().logCalibration(calType, "success");
          cleanupSubs(calType);
          return;
        }

        // Detect failure
        if (lower.includes("calibration failed") || lower.includes("cal failed")) {
          if (!typeRelevant) return;
          if (calType === "compass") {
            // FC auto-retries (param2=1). Only MAG_CAL_REPORT calStatus >= 5 is terminal.
            setter((prev) => ({ ...prev, message: `${text} — retrying automatically...` }));
            return;
          }
          setter((prev) => ({ ...prev, status: "error", message: text, waitingForConfirm: false }));
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration failed`, "error");
          useDiagnosticsStore.getState().logCalibration(calType, "failed");
          cleanupSubs(calType);
          return;
        }

        if (!typeRelevant) return;

        // For accel cal, "place vehicle" messages just update the display text
        // Step progression is driven by onAccelCalPos, not STATUSTEXT
        if (calType === "accel" && lower.match(/place vehicle/)) {
          setter((prev) => ({ ...prev, message: text }));
          return;
        }

        // Generic percentage progress
        const pctMatch = text.match(/(\d+)%/);
        if (pctMatch) {
          setter((prev) => ({ ...prev, progress: parseInt(pctMatch[1], 10), message: text }));
          return;
        }

        // Show relevant status text and reset timeout (FC is responding)
        setter((prev) => ({ ...prev, message: text }));
        resetTimeout(calType, setter);
      });
      addSub(calType, statusUnsub);

      // Fast-completion fallback for simple calibrations (gyro/level/baro/airspeed):
      // If COMMAND_ACK returned success (we're here so it did), set a 5s timer.
      // If no explicit success/failure STATUSTEXT arrived by then but a type-relevant
      // message was received, treat as success.
      const FAST_CAL_TYPES = ["gyro", "level", "baro", "airspeed"];
      if (FAST_CAL_TYPES.includes(calType)) {
        let sawRelevantMsg = false;
        const fastUnsub = protocol.onStatusText(({ text: t }) => {
          const l = t.toLowerCase();
          const kws = TYPE_KEYWORDS[calType] ?? [];
          if (kws.some((kw) => l.includes(kw)) || l.includes(calType)) {
            sawRelevantMsg = true;
          }
        });
        const fastTimer = setTimeout(() => {
          fastUnsub();
          if (!sawRelevantMsg) return;
          setter((prev) => {
            // Only trigger if still in_progress (no success/failure detected yet)
            if (prev.status !== "in_progress") return prev;
            const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
            cleanupSubs(calType);
            return {
              ...INITIAL_STATE,
              status: "success",
              currentStep: stepCount,
              progress: 100,
              message: prev.message || `${calType} calibration complete`,
              needsReboot: rebootTypes.includes(calType),
            };
          });
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
          useDiagnosticsStore.getState().logCalibration(calType, "success");
        }, 5000);
        addSub(calType, fastUnsub);
        addSub(calType, () => clearTimeout(fastTimer));
      }

      // Accel-specific: subscribe to position requests from FC
      if (calType === "accel" && protocol.onAccelCalPos) {
        const accelPosUnsub = protocol.onAccelCalPos(({ position }) => {
          const stepIndex = position - 1; // position 1-6 → index 0-5
          setter((prev) => ({
            ...prev,
            currentStep: stepIndex,
            progress: ((stepIndex + 1) / stepCount) * 100,
            waitingForConfirm: true,
            accelCalPosition: position,
            message: `Place vehicle ${ACCEL_STEPS[stepIndex]?.label ?? `position ${position}`} — press any key or click Confirm`,
          }));
          // Reset timeout on each position request (user needs time to reposition)
          resetTimeout(calType, setter);
        });
        addSub(calType, accelPosUnsub);
      }

      // Compass-specific: MAG_CAL_PROGRESS + MAG_CAL_REPORT
      if (calType === "compass") {
        if (protocol.onMagCalProgress) {
          const magProgressUnsub = protocol.onMagCalProgress(({ compassId, completionPct, calStatus, completionMask }) => {
            setter((prev) => {
              const cp = new Map(prev.compassProgress);
              const cs = new Map(prev.compassStatus);
              const cm = new Map(prev.compassCompletionMask);
              cp.set(compassId, completionPct);
              cs.set(compassId, calStatus);
              cm.set(compassId, completionMask);
              // Overall progress = average of all compasses
              const values = Array.from(cp.values());
              const avgProgress = values.reduce((a, b) => a + b, 0) / values.length;
              // Count covered sectors
              const sectorCount = completionMask.reduce((sum, byte) => {
                let bits = byte;
                let count = 0;
                while (bits) { count += bits & 1; bits >>= 1; }
                return sum + count;
              }, 0);
              const statusText = calStatus <= 2 ? "Collecting samples" : "Refining fit";
              return {
                ...prev,
                compassProgress: cp,
                compassStatus: cs,
                compassCompletionMask: cm,
                progress: avgProgress,
                message: `Compass ${compassId}: ${statusText} — ${Math.round(completionPct)}% (${sectorCount}/80 sectors)`,
              };
            });
            // Reset timeout on each progress message
            resetTimeout(calType, setter);
          });
          addSub(calType, magProgressUnsub);
        }

        // Subscribe to ATTITUDE for live rotation bars (ArduPilot sends 0.0 for MAG_CAL_PROGRESS direction fields)
        if (protocol.onAttitude) {
          const attUnsub = protocol.onAttitude(({ rollSpeed, pitchSpeed, yawSpeed }) => {
            setter((prev) => {
              if (prev.status !== "in_progress") return prev;
              const cd = new Map(prev.compassDirection);
              for (const id of prev.compassProgress.keys()) {
                cd.set(id, { x: rollSpeed, y: pitchSpeed, z: yawSpeed });
              }
              return { ...prev, compassDirection: cd };
            });
          });
          addSub(calType, attUnsub);
        }

        if (protocol.onMagCalReport) {
          const magReportUnsub = protocol.onMagCalReport(({
            compassId, calStatus, autosaved, ofsX, ofsY, ofsZ, fitness,
            diagX, diagY, diagZ, offdiagX, offdiagY, offdiagZ,
            orientationConfidence, oldOrientation, newOrientation, scaleFactor,
          }) => {
            setter((prev) => {
              const cr = new Map(prev.compassResults);
              cr.set(compassId, {
                ofsX, ofsY, ofsZ, fitness, calStatus,
                diagX, diagY, diagZ, offdiagX, offdiagY, offdiagZ,
                orientationConfidence, oldOrientation, newOrientation, scaleFactor,
              });
              const cs = new Map(prev.compassStatus);
              cs.set(compassId, calStatus);

              // If autosaved, mark complete automatically
              if (autosaved === 1 && calStatus === 4) {
                // Check if ALL compasses that sent progress have reported
                const allDone = Array.from(prev.compassProgress.keys()).every((id) => cr.has(id));
                if (allDone || prev.compassProgress.size === 0) {
                  cleanupSubs(calType);
                  useDiagnosticsStore.getState().logCalibration(calType, "success", {
                    offsets: { ofsX, ofsY, ofsZ },
                    fitness,
                    compassId,
                  });
                  return {
                    ...prev,
                    compassResults: cr,
                    compassStatus: cs,
                    status: "success",
                    progress: 100,
                    needsReboot: true,
                    message: "All compasses calibrated successfully. Reboot required for new offsets to take effect.",
                  };
                }
              }

              if (calStatus >= 5) {
                // Check for partial failure (some passed, some failed)
                const passedIds = Array.from(cr.entries()).filter(([, r]) => r.calStatus === 4).map(([id]) => id);
                const failedIds = Array.from(cr.entries()).filter(([, r]) => r.calStatus >= 5).map(([id]) => id);
                const failInfo = MAG_CAL_FAIL_MESSAGES[calStatus];
                let msg: string;
                let fixes: string[] = [];
                if (passedIds.length > 0 && failedIds.length > 0) {
                  msg = `Compass ${passedIds.join(", ")} succeeded, Compass ${failedIds.join(", ")} failed. You can force-save the good offsets or retry all.`;
                } else {
                  msg = failInfo?.message ?? `Compass ${compassId} calibration warning (status ${calStatus})`;
                  fixes = failInfo?.fixes ?? [];
                }
                cleanupSubs(calType);
                useDiagnosticsStore.getState().logCalibration(calType, "failed", {
                  offsets: { ofsX, ofsY, ofsZ },
                  fitness,
                  compassId,
                });
                // Show results with warning — allow force-save instead of terminal error
                return {
                  ...prev,
                  compassResults: cr,
                  compassStatus: cs,
                  status: "cal_warning",
                  waitingForConfirm: true,
                  message: msg + " — review offsets below and Force Save if acceptable, or Retry.",
                  failureFixes: fixes,
                };
              }

              // calStatus === 4 but autosaved === 0: need manual accept
              if (calStatus === 4 && autosaved === 0) {
                // Check if ALL compasses that sent progress have reported success
                const allDone = Array.from(prev.compassProgress.keys()).every((id) => cr.has(id));
                if (allDone || prev.compassProgress.size === 0) {
                  return {
                    ...prev,
                    compassResults: cr,
                    compassStatus: cs,
                    status: "waiting_accept",
                    waitingForConfirm: true,
                    progress: 100,
                    message: "Calibration complete — review offsets and click Accept to save",
                  };
                }
              }
              return {
                ...prev,
                compassResults: cr,
                compassStatus: cs,
              };
            });
          });
          addSub(calType, magReportUnsub);
        }
      }
    },
    [getSelectedProtocol, toast],
  );

  const cancelCalibration = useCallback(
    async (
      type: string,
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
    ) => {
      const protocol = getSelectedProtocol();
      if (protocol) {
        if (type === "compass" && protocol.cancelCompassCal) {
          protocol.cancelCompassCal();
        } else if (protocol.cancelCalibration) {
          // Send PREFLIGHT_CALIBRATION with all zeros to cancel any active cal
          protocol.cancelCalibration();
        }
      }
      cleanupSubs(type);
      useDiagnosticsStore.getState().logCalibration(type, "cancelled");
      setter(INITIAL_STATE);
    },
    [getSelectedProtocol],
  );

  const forceCompassSave = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    const results = Array.from(compass.compassResults.entries());
    if (results.length === 0) return;

    try {
      for (const [compassId, r] of results) {
        // Parameter suffix: compass 0 = "", compass 1 = "2", compass 2 = "3"
        const suffix = compassId === 0 ? "" : `${compassId + 1}`;

        // Hard-iron offsets (always write)
        await protocol.setParameter(`COMPASS_OFS${suffix}_X`, r.ofsX);
        await protocol.setParameter(`COMPASS_OFS${suffix}_Y`, r.ofsY);
        await protocol.setParameter(`COMPASS_OFS${suffix}_Z`, r.ofsZ);

        // Soft-iron diagonal (write if not identity)
        if (r.diagX !== 1 || r.diagY !== 1 || r.diagZ !== 1) {
          await protocol.setParameter(`COMPASS_DIA${suffix}_X`, r.diagX);
          await protocol.setParameter(`COMPASS_DIA${suffix}_Y`, r.diagY);
          await protocol.setParameter(`COMPASS_DIA${suffix}_Z`, r.diagZ);
        }

        // Soft-iron off-diagonal (write if non-zero)
        if (r.offdiagX !== 0 || r.offdiagY !== 0 || r.offdiagZ !== 0) {
          await protocol.setParameter(`COMPASS_ODI${suffix}_X`, r.offdiagX);
          await protocol.setParameter(`COMPASS_ODI${suffix}_Y`, r.offdiagY);
          await protocol.setParameter(`COMPASS_ODI${suffix}_Z`, r.offdiagZ);
        }
      }

      // Persist to flash
      const flashResult = await protocol.commitParamsToFlash();
      if (!flashResult.success) {
        console.error("[Calibration] Flash commit failed:", flashResult.message);
      }

      setCompass((prev) => ({
        ...prev,
        status: "success",
        waitingForConfirm: false,
        needsReboot: true,
        message: "Compass offsets saved to flash. Reboot to apply.",
      }));
      toast("Compass offsets written to flash", "success");
    } catch {
      toast("Failed to write compass offsets", "error");
    }
  }, [getSelectedProtocol, compass.compassResults, toast]);

  const acceptCompass = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.acceptCompassCal) return;

    try {
      const result = await protocol.acceptCompassCal();
      if (!result.success) {
        // FC rejected accept — fall back to direct parameter write
        toast("FC rejected accept — saving offsets directly", "info");
        await forceCompassSave();
        return;
      }

      // Belt and suspenders: commit to flash after accept
      const flashResult = await protocol.commitParamsToFlash();
      if (!flashResult.success) {
        console.error("[Calibration] Flash commit failed:", flashResult.message);
      }

      setCompass((prev) => ({
        ...prev,
        status: "success",
        waitingForConfirm: false,
        progress: 100,
        needsReboot: true,
        message: "Compass offsets saved to flash. Reboot to apply.",
      }));
      cleanupSubs("compass");
      toast("Compass calibration accepted and saved to flash", "success");
    } catch {
      toast("Accept failed — try Force Save", "error");
    }
  }, [getSelectedProtocol, forceCompassSave, toast]);

  const startCalibration = useCallback(
    async (
      type: "accel" | "gyro" | "compass" | "level" | "airspeed" | "baro" | "rc" | "esc" | "compassmot",
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
    ) => {
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      // Clear previous diff
      setCalDiff(null);
      setCalDiffType(null);

      // Snapshot pre-calibration params for before/after comparison
      const paramNames = CAL_SNAPSHOT_PARAMS[type];
      if (paramNames && paramNames.length > 0) {
        const results = await Promise.allSettled(paramNames.map((n) => protocol.getParameter(n)));
        const snap = new Map<string, number>();
        paramNames.forEach((name, i) => {
          const r = results[i];
          if (r.status === "fulfilled") snap.set(name, r.value.value);
        });
        setCalSnapshot(snap);
      } else {
        setCalSnapshot(null);
      }

      // Auto-set COMPASS_AUTO_ROT=3 (lenient) to prevent orientation flickering (ArduPilot only)
      if (!isPx4 && type === "compass" && compassParams.COMPASS_AUTO_ROT !== null && compassParams.COMPASS_AUTO_ROT !== 3) {
        try {
          await protocol.setParameter("COMPASS_AUTO_ROT", 3);
          setCompassParams((p) => ({ ...p, COMPASS_AUTO_ROT: 3 }));
          toast("COMPASS_AUTO_ROT set to 3 (lenient) to prevent orientation flickering", "info");
        } catch { /* non-fatal */ }
      }

      // Set PX4 active cal type so STATUSTEXT parser routes progress correctly
      if (isPx4) {
        setPx4CalActiveType(type);
        setPx4CalProgress(0);
        setPx4CalStatus("running");
        setPx4CalCompletedSides(new Set());
      }

      setter({
        ...INITIAL_STATE,
        status: "in_progress",
        message: "Starting calibration...",
      });
      subscribeToStatus(setter, stepCount, type);

      try {
        const result = await protocol.startCalibration(type);
        if (!result.success) {
          cleanupSubs(type);
          if (isPx4) setPx4CalActiveType(null);
          const msg = result.resultCode === 5
            ? "Calibration already in progress — cancel first or wait for it to finish"
            : result.resultCode === 1
            ? "FC temporarily busy — wait a moment and retry"
            : result.message || "Calibration command rejected";
          setter((prev) => ({
            ...prev,
            status: "error",
            message: msg,
          }));
          toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration: ${msg}`, "error");
        } else {
          toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration started`, "info");
        }
      } catch {
        cleanupSubs(type);
        if (isPx4) setPx4CalActiveType(null);
        setter((prev) => ({
          ...prev,
          status: "error",
          message: "Failed to send calibration command",
        }));
        toast("Failed to send calibration command", "error");
      }
    },
    [getSelectedProtocol, subscribeToStatus, toast, compassParams.COMPASS_AUTO_ROT, setCompassParams, isPx4],
  );

  // PX4-only: Quick Level calibration (PREFLIGHT_CALIBRATION param5=4)
  const startPx4QuickLevel = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    setPx4CalActiveType("quick-level");
    setPx4CalProgress(0);
    setPx4CalStatus("running");
    setPx4QuickLevel({
      ...INITIAL_STATE,
      status: "in_progress",
      message: "Starting quick level calibration...",
    });
    subscribeToStatus(setPx4QuickLevel, 1, "level");

    try {
      // MAV_CMD_PREFLIGHT_CALIBRATION (241) with param5=4 = PX4 quick level
      const result = await protocol.startCalibration("level");
      if (!result.success) {
        cleanupSubs("level");
        setPx4CalActiveType(null);
        setPx4QuickLevel((prev) => ({
          ...prev,
          status: "error",
          message: result.message || "Quick level command rejected",
        }));
        toast("Quick level calibration failed", "error");
      } else {
        toast("Quick level calibration started", "info");
      }
    } catch {
      cleanupSubs("level");
      setPx4CalActiveType(null);
      setPx4QuickLevel((prev) => ({
        ...prev,
        status: "error",
        message: "Failed to send quick level command",
      }));
      toast("Failed to send quick level command", "error");
    }
  }, [getSelectedProtocol, subscribeToStatus, toast]);

  // PX4-only: GNSS Mag Cal (MAV_CMD_FIXED_MAG_CAL_YAW = 42006)
  const startPx4GnssMagCal = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    setPx4CalActiveType("gnss-mag");
    setPx4CalProgress(0);
    setPx4CalStatus("running");
    setPx4GnssMagCal({
      ...INITIAL_STATE,
      status: "in_progress",
      message: "Starting GNSS mag calibration... Ensure GPS fix.",
    });

    try {
      // MAV_CMD_FIXED_MAG_CAL_YAW (42006) — uses GPS heading to calibrate compass yaw
      const result = protocol.startGnssMagCal
        ? await protocol.startGnssMagCal()
        : { success: false, resultCode: -1, message: "GNSS mag cal not supported by this firmware" };
      if (!result.success) {
        setPx4CalActiveType(null);
        setPx4GnssMagCal((prev) => ({
          ...prev,
          status: "error",
          message: result.message || "GNSS mag cal command rejected. Ensure GPS has a fix.",
        }));
        toast("GNSS mag calibration failed", "error");
      } else {
        // For GNSS mag cal, success is immediate (single command, no progress)
        // PX4 may also send [cal] STATUSTEXT messages, which the parser handles
        setPx4GnssMagCal((prev) => ({
          ...INITIAL_STATE,
          status: "success",
          progress: 100,
          message: "GNSS mag calibration complete. Compass yaw aligned to GPS heading.",
          needsReboot: true,
        }));
        setPx4CalStatus("success");
        setPx4CalActiveType(null);
        toast("GNSS mag calibration complete", "success");
        useDiagnosticsStore.getState().logCalibration("gnss-mag", "success");
      }
    } catch {
      setPx4CalActiveType(null);
      setPx4GnssMagCal((prev) => ({
        ...prev,
        status: "error",
        message: "Failed to send GNSS mag cal command",
      }));
      toast("Failed to send GNSS mag cal command", "error");
    }
  }, [getSelectedProtocol, toast]);

  const compassProgressEntries: CompassProgressEntry[] = Array.from(compass.compassProgress.entries())
    .map(([id, pct]) => ({
      compassId: id,
      completionPct: pct,
      calStatus: compass.compassStatus.get(id) ?? 0,
      completionMask: compass.compassCompletionMask.get(id) ?? [],
      direction: compass.compassDirection.get(id) ?? { x: 0, y: 0, z: 0 },
    }));

  const compassResultEntries: CompassResultEntry[] = Array.from(compass.compassResults.entries())
    .map(([id, r]) => ({ ...r, compassId: id }));

  return (
    <ArmedLockOverlay className="overflow-y-auto">
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left: Calibration Wizards */}
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Sensor Calibration</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Step-by-step calibration wizards for accelerometer, gyroscope, compass, level, and airspeed
            </p>
            {!connected && (
              <p className="text-[10px] text-status-warning mt-2">
                Connect a drone to run calibrations
              </p>
            )}
          </div>

          {/* Accelerometer — 6-position */}
          <CalibrationWizard
            title="Accelerometer Calibration"
            description="6-position calibration. Place vehicle in each orientation when prompted."
            steps={ACCEL_STEPS}
            currentStep={accel.currentStep}
            status={accel.status}
            progress={accel.progress}
            statusMessage={accel.message}
            waitingForConfirm={accel.waitingForConfirm}
            onConfirm={confirmAccelPosition}
            onStart={() => startCalibration("accel", setAccel, ACCEL_STEPS.length)}
            onCancel={() => cancelCalibration("accel", setAccel)}
          />

          {/* Gyroscope */}
          <CalibrationWizard
            title="Gyroscope Calibration"
            description="Keep vehicle perfectly still during calibration."
            steps={GYRO_STEPS}
            currentStep={gyro.currentStep}
            status={gyro.status}
            progress={gyro.progress}
            statusMessage={gyro.message}
            onStart={() => startCalibration("gyro", setGyro, GYRO_STEPS.length)}
            onCancel={() => cancelCalibration("gyro", setGyro)}
          />

          {/* Compass pre-calibration param checks */}
          {/* ArduPilot compass pre-flight checks — not applicable for PX4 */}
          {connected && !isPx4 && compass.status === "idle" && (
            <div className="border border-border-default bg-bg-secondary p-4">
              <h3 className="text-xs font-medium text-text-primary mb-2">Compass Pre-flight Checks</h3>
              <div className="space-y-1.5">
                {/* COMPASS_USE */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_USE</span>
                  {compassParams.COMPASS_USE === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : compassParams.COMPASS_USE === 1 ? (
                    <span className="text-status-success font-mono">Enabled</span>
                  ) : (
                    <span className="text-status-error font-mono">Disabled — enable COMPASS_USE first</span>
                  )}
                </div>
                {/* COMPASS_ORIENT */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_ORIENT</span>
                  {compassParams.COMPASS_ORIENT === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : (
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_ORIENT} {compassParams.COMPASS_ORIENT === 0 ? "(None)" : compassParams.COMPASS_ORIENT === 6 ? "(Yaw270)" : ""}
                    </span>
                  )}
                </div>
                {/* COMPASS_AUTO_ROT */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_AUTO_ROT</span>
                  {compassParams.COMPASS_AUTO_ROT === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : compassParams.COMPASS_AUTO_ROT === 3 ? (
                    <span className="text-status-success font-mono">3 (Lenient)</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-status-warning font-mono">{compassParams.COMPASS_AUTO_ROT} — recommend 3 for lenient orientation detection</span>
                      <button
                        className="text-[9px] text-accent-primary hover:underline"
                        onClick={async () => {
                          const protocol = getSelectedProtocol();
                          if (!protocol) return;
                          await protocol.setParameter("COMPASS_AUTO_ROT", 3);
                          setCompassParams((p) => ({ ...p, COMPASS_AUTO_ROT: 3 }));
                          toast("COMPASS_AUTO_ROT set to 3", "success");
                        }}
                      >
                        Fix
                      </button>
                    </span>
                  )}
                </div>
                {/* COMPASS_OFFS_MAX */}
                {compassParams.COMPASS_OFFS_MAX !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_OFFS_MAX</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("font-mono", compassParams.COMPASS_OFFS_MAX < 850 ? "text-status-warning" : "text-text-primary")}>
                        {compassParams.COMPASS_OFFS_MAX} {compassParams.COMPASS_OFFS_MAX < 850 ? "— low limit" : ""}
                      </span>
                      {compassParams.COMPASS_OFFS_MAX < 2000 && (
                        <button
                          className="text-[9px] text-accent-primary hover:underline"
                          onClick={async () => {
                            const protocol = getSelectedProtocol();
                            if (!protocol) return;
                            await protocol.setParameter("COMPASS_OFFS_MAX", 2000);
                            setCompassParams((p) => ({ ...p, COMPASS_OFFS_MAX: 2000 }));
                            toast("COMPASS_OFFS_MAX set to 2000", "success");
                          }}
                        >
                          Increase to 2000
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {/* COMPASS_LEARN */}
                {compassParams.COMPASS_LEARN !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_LEARN</span>
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_LEARN} ({compassParams.COMPASS_LEARN === 0 ? "Off" : compassParams.COMPASS_LEARN === 1 ? "Internal" : compassParams.COMPASS_LEARN === 2 ? "EKF" : compassParams.COMPASS_LEARN === 3 ? "InFlight" : "Unknown"})
                    </span>
                  </div>
                )}
                {/* COMPASS_EXTERNAL */}
                {compassParams.COMPASS_EXTERNAL !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_EXTERNAL</span>
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_EXTERNAL === 1 ? "External" : "Internal"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compass */}
          <CalibrationWizard
            title="Compass Calibration"
            description="Rotate vehicle slowly in all orientations until complete."
            steps={COMPASS_STEPS}
            currentStep={compass.currentStep}
            status={compass.status}
            progress={compass.progress}
            statusMessage={compass.message}
            waitingForConfirm={compass.waitingForConfirm}
            onConfirm={acceptCompass}
            confirmLabel="Accept Offsets"
            compassProgress={compassProgressEntries}
            compassResults={compassResultEntries}
            failureFixes={compass.failureFixes}
            onForceSave={forceCompassSave}
            preTips={[
              "Move at least 3m away from metal objects, vehicles, and buildings",
              "Remove magnetic accessories (phone mounts, metal tools) from nearby",
              "Ensure GPS fix if possible (helps validate compass orientation)",
              "Keep a firm grip — you will rotate the drone through all axes",
            ]}
            onStart={() => startCalibration("compass", setCompass, COMPASS_STEPS.length)}
            onCancel={() => cancelCalibration("compass", setCompass)}
          />

          {/* Compass Reboot Required Banner */}
          {compass.needsReboot && compass.status === "success" && (
            <CalibrationRebootBanner label="Compass offsets saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Orientation change alert */}
          {compass.status === "success" && compassResultEntries.some(
            (r) => r.oldOrientation !== r.newOrientation && r.newOrientation !== 0
          ) && (
            <div className="border border-status-warning/30 bg-status-warning/10 px-4 py-3">
              <p className="text-xs font-medium text-status-warning">Compass Orientation Changed</p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                The calibration detected a different compass orientation than previously configured.
                Verify mounting orientation in parameters after reboot.
              </p>
            </div>
          )}

          {/* Accel Reboot Banner */}
          {accel.needsReboot && accel.status === "success" && (
            <CalibrationRebootBanner label="Accelerometer calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Level */}
          <CalibrationWizard
            title="Level Calibration"
            description="Set the reference level horizon for the flight controller."
            steps={LEVEL_STEPS}
            currentStep={level.currentStep}
            status={level.status}
            progress={level.progress}
            statusMessage={level.message}
            onStart={() => startCalibration("level", setLevel, LEVEL_STEPS.length)}
            onCancel={() => cancelCalibration("level", setLevel)}
          />

          {/* Level Reboot Banner */}
          {level.needsReboot && level.status === "success" && (
            <CalibrationRebootBanner label="Level calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Airspeed — ArduPlane only */}
          <CalibrationWizard
            title="Airspeed Calibration"
            description="ArduPlane only — cover the pitot tube opening before starting."
            steps={AIRSPEED_STEPS}
            currentStep={airspeed.currentStep}
            status={airspeed.status}
            progress={airspeed.progress}
            statusMessage={airspeed.message}
            onStart={() => startCalibration("airspeed", setAirspeed, AIRSPEED_STEPS.length)}
            onCancel={() => cancelCalibration("airspeed", setAirspeed)}
          />

          {/* Barometer */}
          <CalibrationWizard
            title="Barometer Calibration"
            description="Resets ground pressure reference. Keep vehicle still during calibration."
            steps={BARO_STEPS}
            currentStep={baro.currentStep}
            status={baro.status}
            progress={baro.progress}
            statusMessage={baro.message}
            onStart={() => startCalibration("baro", setBaro, BARO_STEPS.length)}
            onCancel={() => cancelCalibration("baro", setBaro)}
          />

          {/* Baro live pressure readout */}
          {connected && baroPressure && (
            <div className="border border-border-default bg-bg-secondary px-4 py-2.5 -mt-4">
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="text-text-secondary">Pressure</span>
                <span className="text-text-primary">{baroPressure.pressAbs.toFixed(2)} hPa</span>
                <span className="text-text-secondary">Temp</span>
                <span className="text-text-primary">{baroPressure.temperature.toFixed(1)} °C</span>
              </div>
            </div>
          )}

          {/* Radio Calibration */}
          <RcCalibrationWizard connected={connected} />

          {/* RC Channel Assignment */}
          <RcChannelMapSection />

          {/* GPS Configuration — Antenna Offset + Constellation */}
          <GpsConfigSection />

          {/* Servo Endpoint Calibration */}
          <ServoCalibrationSection />

          {/* ESC Calibration */}
          <CalibrationWizard
            title="ESC Calibration"
            description="Set ESC throttle endpoints. REMOVE ALL PROPELLERS before starting."
            steps={ESC_CAL_STEPS}
            currentStep={esc.currentStep}
            status={esc.status}
            progress={esc.progress}
            statusMessage={esc.message}
            preTips={[
              "CRITICAL: Remove ALL propellers before starting",
              "Disconnect battery before beginning the sequence",
              "Some ESCs require this calibration on first use",
              "If using BLHeli/SimonK ESCs, use their own calibration tools instead",
            ]}
            onStart={() => startCalibration("esc", setEsc, ESC_CAL_STEPS.length)}
            onCancel={() => cancelCalibration("esc", setEsc)}
          />

          {/* ESC Reboot Banner */}
          {esc.needsReboot && esc.status === "success" && (
            <CalibrationRebootBanner label="ESC calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* CompassMot */}
          <CalibrationWizard
            title="CompassMot (Motor Interference)"
            description="Measures magnetic interference from motors/ESCs at various throttle levels. Compensates compass readings."
            steps={COMPASSMOT_STEPS}
            currentStep={compassmot.currentStep}
            status={compassmot.status}
            progress={compassmot.progress}
            statusMessage={compassmot.message}
            preTips={[
              "Ensure GPS has 3D fix before starting",
              "Vehicle must be in open area away from metal objects",
              "Props ON — motors WILL spin during this test",
              "Interference below 30% is acceptable, below 15% is good",
            ]}
            onStart={() => startCalibration("compassmot", setCompassmot, COMPASSMOT_STEPS.length)}
            onCancel={() => cancelCalibration("compassmot", setCompassmot)}
          />

          {/* CompassMot Reboot Banner */}
          {compassmot.needsReboot && compassmot.status === "success" && (
            <CalibrationRebootBanner label="CompassMot calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* PX4-Only Calibrations */}
          {isPx4 && (
            <>
              <div>
                <h2 className="text-sm font-display font-semibold text-text-primary mt-2 mb-1">PX4-Only Calibrations</h2>
                <p className="text-[10px] text-text-tertiary mb-4">
                  Additional calibration options available on PX4 firmware
                </p>
              </div>

              {/* PX4 Quick Level */}
              <CalibrationWizard
                title="Quick Level (PX4)"
                description="Set level reference from current orientation. Place vehicle level before starting."
                steps={LEVEL_STEPS}
                currentStep={px4QuickLevel.currentStep}
                status={px4QuickLevel.status}
                progress={px4QuickLevel.progress}
                statusMessage={px4QuickLevel.message}
                onStart={startPx4QuickLevel}
                onCancel={() => cancelCalibration("level", setPx4QuickLevel)}
              />

              {/* PX4 Quick Level Reboot Banner */}
              {px4QuickLevel.needsReboot && px4QuickLevel.status === "success" && (
                <CalibrationRebootBanner label="Quick level calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
              )}

              {/* PX4 GNSS Mag Cal */}
              <CalibrationWizard
                title="GNSS Mag Calibration (PX4)"
                description="Calibrate compass yaw using GPS heading. Requires good GPS fix. No rotation needed."
                steps={[{ label: "GPS Fix", description: "Ensure the vehicle has a solid GPS fix outdoors" }]}
                currentStep={px4GnssMagCal.currentStep}
                status={px4GnssMagCal.status}
                progress={px4GnssMagCal.progress}
                statusMessage={px4GnssMagCal.message}
                preTips={[
                  "Ensure vehicle is outdoors with clear sky view",
                  "Wait for good GPS fix (>6 satellites) before starting",
                  "Point vehicle nose in a known direction",
                  "This calibration is quick and does not require rotation",
                ]}
                onStart={startPx4GnssMagCal}
              />

              {/* GNSS Mag Cal Reboot Banner */}
              {px4GnssMagCal.needsReboot && px4GnssMagCal.status === "success" && (
                <CalibrationRebootBanner label="GNSS mag calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
              )}

              {/* PX4 Thermal Calibration — deferred */}
              <div className="mt-4 p-3 rounded-md bg-bg-tertiary border border-border-default opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-text-secondary">Thermal Calibration</div>
                    <div className="text-[10px] text-text-tertiary">Requires cold-start hardware workflow. Coming in a future release.</div>
                  </div>
                  <Button size="sm" disabled>
                    Start
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Calibration Before/After Comparison */}
          {calDiff && calDiff.length > 0 && calDiffType && (
            <div className="border border-border-default bg-bg-secondary p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-xs font-medium text-text-primary">
                    {calDiffType.charAt(0).toUpperCase() + calDiffType.slice(1)} Calibration Changes
                  </h3>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    Parameters changed during calibration
                  </p>
                </div>
                <button
                  className="text-[10px] text-text-tertiary hover:text-text-secondary"
                  onClick={() => { setCalDiff(null); setCalDiffType(null); }}
                >
                  Dismiss
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-text-tertiary">
                      <th className="text-left px-1 py-0.5">Parameter</th>
                      <th className="text-right px-1 py-0.5">Before</th>
                      <th className="text-right px-1 py-0.5">After</th>
                      <th className="text-right px-1 py-0.5">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calDiff.map((d) => {
                      const change = d.after - d.before;
                      return (
                        <tr key={d.name} className="border-t border-border-default/50">
                          <td className="text-left px-1 py-0.5 text-text-secondary">{d.name}</td>
                          <td className="text-right px-1 py-0.5 text-text-tertiary">{d.before.toFixed(4)}</td>
                          <td className="text-right px-1 py-0.5 text-text-primary">{d.after.toFixed(4)}</td>
                          <td className={cn(
                            "text-right px-1 py-0.5",
                            change > 0 ? "text-status-success" : change < 0 ? "text-status-warning" : "text-text-tertiary"
                          )}>
                            {change > 0 ? "+" : ""}{change.toFixed(4)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pb-4" />
        </div>

        {/* Right: Calibration Log */}
        <CalibrationLog logEntries={logEntries} onClear={() => setLogEntries([])} />
      </div>
    </div>
    </ArmedLockOverlay>
  );
}
