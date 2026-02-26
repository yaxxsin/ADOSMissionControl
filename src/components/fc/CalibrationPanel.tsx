"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  CalibrationWizard,
  type CalibrationStatus,
  type CalibrationStep,
  type CompassProgressEntry,
  type CompassResultEntry,
} from "./CalibrationWizard";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompassResult {
  ofsX: number; ofsY: number; ofsZ: number;
  fitness: number; calStatus: number;
  diagX: number; diagY: number; diagZ: number;
  offdiagX: number; offdiagY: number; offdiagZ: number;
  orientationConfidence: number;
  oldOrientation: number; newOrientation: number;
  scaleFactor: number;
}

interface CalibrationState {
  status: CalibrationStatus;
  currentStep: number;
  progress: number;
  message: string;
  waitingForConfirm: boolean;
  accelCalPosition: number | null;
  compassProgress: Map<number, number>;
  compassStatus: Map<number, number>;
  compassResults: Map<number, CompassResult>;
  compassCompletionMask: Map<number, number[]>;
  compassDirection: Map<number, { x: number; y: number; z: number }>;
  needsReboot: boolean;
}

const INITIAL_STATE: CalibrationState = {
  status: "idle",
  currentStep: 0,
  progress: 0,
  message: "",
  waitingForConfirm: false,
  accelCalPosition: null,
  compassProgress: new Map(),
  compassStatus: new Map(),
  compassResults: new Map(),
  compassCompletionMask: new Map(),
  compassDirection: new Map(),
  needsReboot: false,
};

// ArduPilot ACCELCAL_VEHICLE_POS enum: 1=Level, 2=Left, 3=Right, 4=NoseDown, 5=NoseUp, 6=Back
const ACCEL_STEPS: CalibrationStep[] = [
  { label: "Level", description: "Place vehicle level on a flat surface" },
  { label: "Left Side", description: "Rotate vehicle so left side faces down" },
  { label: "Right Side", description: "Rotate vehicle so right side faces down" },
  { label: "Nose Down", description: "Point the nose straight down" },
  { label: "Nose Up", description: "Point the nose straight up" },
  { label: "Back", description: "Place vehicle upside-down" },
];

const GYRO_STEPS: CalibrationStep[] = [
  { label: "Keep Still", description: "Keep the vehicle perfectly still on a level surface" },
];

const COMPASS_STEPS: CalibrationStep[] = [
  { label: "Rotate", description: "Slowly rotate the vehicle in all orientations — roll, pitch, and yaw" },
];

const LEVEL_STEPS: CalibrationStep[] = [
  { label: "Level Surface", description: "Place vehicle on a perfectly level surface" },
];

const AIRSPEED_STEPS: CalibrationStep[] = [
  { label: "Cover Pitot", description: "Cover the pitot tube opening to seal it from airflow" },
];

/** Keywords per calibration type — only messages containing these are shown */
const TYPE_KEYWORDS: Record<string, string[]> = {
  accel: ["accel", "place vehicle"],
  gyro: ["gyro"],
  compass: ["compass", "mag"],
  level: ["level", "horizon"],
  airspeed: ["airspeed", "baro", "pitot"],
};

/** Human-readable compass calibration failure messages */
const MAG_CAL_FAIL_MESSAGES: Record<number, string> = {
  5: "Calibration failed — strong magnetic interference detected. Move away from metal objects, vehicles, and power lines, then retry.",
  6: "Calibration failed — insufficient rotation coverage. Rotate the drone more slowly through ALL orientations (roll, pitch, yaw), ensuring full 360° coverage in each axis.",
  7: "Calibration failed — field radius out of range. This usually indicates the compass is too close to motors or battery. Check mounting position.",
};

/** Keywords to capture for the calibration log */
const LOG_KEYWORDS = [
  "calibrat", "accel", "gyro", "compass", "mag", "level",
  "place vehicle", "baro", "airspeed", "pitot", "horizon",
];

const CAL_TIMEOUT_MS = 60_000;
const COMPASS_TIMEOUT_MS = 120_000;
const MAX_LOG_ENTRIES = 200;

interface CalibrationLogEntry {
  timestamp: number;
  text: string;
  severity: number;
}

const SEVERITY_COLORS: Record<number, string> = {
  0: "text-status-error",     // EMERGENCY
  1: "text-status-error",     // ALERT
  2: "text-status-error",     // CRITICAL
  3: "text-status-error",     // ERROR
  4: "text-status-warning",   // WARNING
  5: "text-text-secondary",   // NOTICE
  6: "text-text-tertiary",    // INFO
  7: "text-text-tertiary",    // DEBUG
};

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const connected = !!getSelectedProtocol();

  const [accel, setAccel] = useState<CalibrationState>(INITIAL_STATE);
  const [gyro, setGyro] = useState<CalibrationState>(INITIAL_STATE);
  const [compass, setCompass] = useState<CalibrationState>(INITIAL_STATE);
  const [level, setLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [airspeed, setAirspeed] = useState<CalibrationState>(INITIAL_STATE);
  const [logEntries, setLogEntries] = useState<CalibrationLogEntry[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);

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

  function resetTimeout(type: string, setter: React.Dispatch<React.SetStateAction<CalibrationState>>) {
    const old = timeoutRef.current.get(type);
    if (old) clearTimeout(old);
    const newTimeout = setTimeout(() => {
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        cleanupSubs(type);
        return { ...prev, status: "error", message: "Calibration timed out — no response from flight controller" };
      });
    }, CAL_TIMEOUT_MS);
    timeoutRef.current.set(type, newTimeout);
    // Also register for cleanup
    addSub(type, () => clearTimeout(newTimeout));
  }

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries]);

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

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const type of subsRef.current.keys()) {
        cleanupSubs(type);
      }
    };
  }, []);

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

      // Initial timeout (compass gets extended time — real calibrations routinely take 30-60s)
      const timeout = calType === "compass" ? COMPASS_TIMEOUT_MS : CAL_TIMEOUT_MS;
      const timeoutId = setTimeout(() => {
        setter((prev) => {
          if (prev.status !== "in_progress") return prev;
          cleanupSubs(calType);
          return { ...prev, status: "error", message: "Calibration timed out — no response from flight controller" };
        });
      }, timeout);
      timeoutRef.current.set(calType, timeoutId);
      addSub(calType, () => clearTimeout(timeoutId));

      const statusUnsub = protocol.onStatusText(({ text }) => {
        const lower = text.toLowerCase();

        const typeRelevant =
          keywords.some((kw) => lower.includes(kw)) || lower.includes(calType);

        // Detect completion
        const isSuccessMessage =
          lower.includes("calibration successful") ||
          lower.includes("calibration done") ||
          lower.includes("calibration complete") ||
          (lower.includes("calibrated") && lower.includes("requires reboot"));

        if (isSuccessMessage) {
          // Generic success (no type keyword) is accepted if calibration is active
          const isGenericSuccess = !keywords.some((kw) => lower.includes(kw)) && !lower.includes(calType);
          setter((prev) => {
            if (prev.status !== "in_progress") return prev;
            if (!typeRelevant && !isGenericSuccess) return prev;
            return {
              ...INITIAL_STATE,
              status: "success",
              currentStep: stepCount,
              progress: 100,
              message: text,
            };
          });
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
          cleanupSubs(calType);
          return;
        }

        // Detect failure
        if (lower.includes("calibration failed") || lower.includes("cal failed")) {
          if (!typeRelevant) return;
          setter((prev) => ({ ...prev, status: "error", message: text, waitingForConfirm: false }));
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration failed`, "error");
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

        // Show relevant status text
        setter((prev) => ({ ...prev, message: text }));
      });
      addSub(calType, statusUnsub);

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
          const magProgressUnsub = protocol.onMagCalProgress(({ compassId, completionPct, calStatus, completionMask, directionX, directionY, directionZ }) => {
            setter((prev) => {
              const cp = new Map(prev.compassProgress);
              const cs = new Map(prev.compassStatus);
              const cm = new Map(prev.compassCompletionMask);
              const cd = new Map(prev.compassDirection);
              cp.set(compassId, completionPct);
              cs.set(compassId, calStatus);
              cm.set(compassId, completionMask);
              cd.set(compassId, { x: directionX, y: directionY, z: directionZ });
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
                compassDirection: cd,
                progress: avgProgress,
                message: `Compass ${compassId}: ${statusText} — ${Math.round(completionPct)}% (${sectorCount}/80 sectors)`,
              };
            });
            // Reset timeout on each progress message
            resetTimeout(calType, setter);
          });
          addSub(calType, magProgressUnsub);
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
                let msg: string;
                if (passedIds.length > 0 && failedIds.length > 0) {
                  msg = `Compass ${passedIds.join(", ")} succeeded, Compass ${failedIds.join(", ")} failed. All compasses must pass for calibration to save. Retry recommended.`;
                } else {
                  msg = MAG_CAL_FAIL_MESSAGES[calStatus] ?? `Compass ${compassId} calibration failed (status ${calStatus})`;
                }
                cleanupSubs(calType);
                return { ...prev, compassResults: cr, compassStatus: cs, status: "error", message: msg };
              }

              // calStatus === 4 but autosaved === 0: need manual accept
              return {
                ...prev,
                compassResults: cr,
                compassStatus: cs,
                needsReboot: calStatus === 4 ? true : prev.needsReboot,
                waitingForConfirm: calStatus === 4 && autosaved === 0,
                message: calStatus === 4 && autosaved === 0
                  ? "Compass calibration complete — click Accept to save offsets"
                  : prev.message,
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
    (
      type: string,
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
    ) => {
      const protocol = getSelectedProtocol();
      // For compass, send cancel command to FC
      if (type === "compass" && protocol?.cancelCompassCal) {
        protocol.cancelCompassCal();
      }
      cleanupSubs(type);
      setter(INITIAL_STATE);
    },
    [getSelectedProtocol],
  );

  const acceptCompass = useCallback(() => {
    const protocol = getSelectedProtocol();
    if (!protocol?.acceptCompassCal) return;
    protocol.acceptCompassCal();
    setCompass((prev) => ({
      ...prev,
      status: "success",
      waitingForConfirm: false,
      progress: 100,
      needsReboot: true,
      message: "All compasses calibrated successfully. Reboot required for new offsets to take effect.",
    }));
    cleanupSubs("compass");
  }, [getSelectedProtocol]);

  const startCalibration = useCallback(
    async (
      type: "accel" | "gyro" | "compass" | "level" | "airspeed",
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
    ) => {
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      setter({
        ...INITIAL_STATE,
        status: "in_progress",
        message: "Starting calibration...",
      });
      subscribeToStatus(setter, stepCount, type);

      try {
        const result = await protocol.startCalibration(type);
        if (!result.success) {
          const definitiveFailure = [2, 3, 4, 6].includes(result.resultCode);
          if (definitiveFailure) {
            cleanupSubs(type);
            setter((prev) => ({
              ...prev,
              status: "error",
              message: result.message || "Calibration command rejected",
            }));
            toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration rejected`, "error");
          }
        } else {
          toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration started`, "info");
        }
      } catch {
        cleanupSubs(type);
        setter((prev) => ({
          ...prev,
          status: "error",
          message: "Failed to send calibration command",
        }));
        toast("Failed to send calibration command", "error");
      }
    },
    [getSelectedProtocol, subscribeToStatus, toast],
  );

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
            preTips={[
              "Move at least 3m away from metal objects, vehicles, and buildings",
              "Remove magnetic accessories (phone mounts, metal tools) from nearby",
              "Ensure GPS fix if possible (helps validate compass orientation)",
              "Keep a firm grip — you will rotate the drone through all axes",
            ]}
            onStart={() => startCalibration("compass", setCompass, COMPASS_STEPS.length)}
            onCancel={() => cancelCalibration("compass", setCompass)}
          />

          {/* Reboot Required Banner */}
          {compass.needsReboot && compass.status === "success" && (
            <div className="flex items-center justify-between gap-3 border border-status-warning/30 bg-status-warning/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-status-warning">Reboot Required</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Compass offsets saved. Reboot the flight controller to apply new calibration.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const protocol = getSelectedProtocol();
                  if (protocol) protocol.reboot();
                }}
              >
                Reboot FC
              </Button>
            </div>
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

          <div className="pb-4" />
        </div>

        {/* Right: Calibration Log */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="border border-border-default bg-bg-secondary">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
              <h3 className="text-xs font-medium text-text-primary">Calibration Log</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogEntries([])}
                className="h-5 w-5 p-0"
                title="Clear log"
              >
                <Trash2 size={12} />
              </Button>
            </div>
            <div className="h-[400px] overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
              {logEntries.length === 0 ? (
                <p className="text-text-tertiary italic">No calibration messages yet</p>
              ) : (
                logEntries.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-text-tertiary shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className={cn(SEVERITY_COLORS[entry.severity] ?? "text-text-tertiary")}>
                      {entry.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
