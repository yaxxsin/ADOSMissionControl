"use client";

import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalibrationStatus = "idle" | "in_progress" | "waiting_accept" | "cal_warning" | "success" | "error";

export interface CalibrationStep {
  label: string;
  description: string;
}

export interface CompassProgressEntry {
  compassId: number;
  completionPct: number;
  calStatus: number;
  completionMask: number[];
  direction: { x: number; y: number; z: number };
}

export interface CompassResultEntry {
  compassId: number;
  ofsX: number;
  ofsY: number;
  ofsZ: number;
  fitness: number;
  calStatus: number;
  diagX: number;
  diagY: number;
  diagZ: number;
  offdiagX: number;
  offdiagY: number;
  offdiagZ: number;
  orientationConfidence: number;
  oldOrientation: number;
  newOrientation: number;
  scaleFactor: number;
}

interface CalibrationWizardProps {
  title: string;
  description: string;
  steps: CalibrationStep[];
  currentStep: number;
  status: CalibrationStatus;
  progress?: number;
  statusMessage?: string;
  waitingForConfirm?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  compassProgress?: CompassProgressEntry[];
  compassResults?: CompassResultEntry[];
  failureFixes?: string[];
  preTips?: string[];
  onStart: () => void;
  onCancel?: () => void;
  onForceSave?: () => void;
  unsupportedNotice?: string;
  className?: string;
}

const statusBadge: Record<CalibrationStatus, { label: string; className: string }> = {
  idle: { label: "Ready", className: "bg-bg-tertiary text-text-tertiary" },
  in_progress: { label: "Calibrating", className: "bg-accent-primary/20 text-accent-primary" },
  waiting_accept: { label: "Review & Accept", className: "bg-status-warning/20 text-status-warning" },
  cal_warning: { label: "Review Results", className: "bg-status-warning/20 text-status-warning" },
  success: { label: "Complete", className: "bg-status-success/20 text-status-success" },
  error: { label: "Failed", className: "bg-status-error/20 text-status-error" },
};

// ── Fitness thresholds (aligned with QGC) ──────────────────

function fitnessColor(fitness: number): string {
  if (fitness < 8) return "text-status-success";
  if (fitness < 16) return "text-status-warning";
  if (fitness < 32) return "text-accent-primary";
  return "text-status-error";
}

function fitnessLabel(fitness: number): string {
  if (fitness < 8) return "Excellent";
  if (fitness < 16) return "Good";
  if (fitness < 32) return "Acceptable";
  return "Poor";
}

function fitnessBgColor(fitness: number): string {
  if (fitness < 8) return "bg-status-success";
  if (fitness < 16) return "bg-status-warning";
  if (fitness < 32) return "bg-accent-primary";
  return "bg-status-error";
}

// ── Offset magnitude coloring (Mission Planner pattern) ────

function offsetMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function offsetColor(x: number, y: number, z: number): string {
  const mag = offsetMagnitude(x, y, z);
  if (mag < 400) return "text-status-success";
  if (mag < 600) return "text-status-warning";
  return "text-status-error";
}

// ── Soft-iron validation colors ────────────────────────────

function diagColor(v: number): string {
  if (v >= 0.7 && v <= 1.3) return "text-status-success";
  if (v >= 0.5 && v <= 1.5) return "text-status-warning";
  return "text-status-error";
}

function offdiagColor(v: number): string {
  const abs = Math.abs(v);
  if (abs < 0.1) return "text-status-success";
  if (abs < 0.3) return "text-status-warning";
  return "text-status-error";
}

// ── Rotation hint from direction vector ────────────────────

function getRotationHint(direction: { x: number; y: number; z: number }): string | null {
  const { x, y, z } = direction;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 0.3) return null;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (az >= ax && az >= ay) return z > 0 ? "Tilt nose UP" : "Tilt nose DOWN";
  if (ay >= ax && ay >= az) return y > 0 ? "Roll RIGHT" : "Roll LEFT";
  return x > 0 ? "Yaw RIGHT" : "Yaw LEFT";
}

// ── MAG_CAL_STATUS text mapping ────────────────────────────

function calStatusText(status: number): string {
  switch (status) {
    case 0: return "Not started";
    case 1: return "Waiting to start...";
    case 2: return "Collecting samples...";
    case 3: return "Refining fit...";
    case 4: return "Calibration successful";
    case 5: return "Failed — magnetic interference";
    case 6: return "Failed — insufficient rotation";
    case 7: return "Failed — field out of range";
    default: return `Status ${status}`;
  }
}

// ── Sector count from completionMask ───────────────────────

function countSectors(mask: number[]): number {
  let count = 0;
  for (const byte of mask) {
    let bits = byte;
    while (bits) { count += bits & 1; bits >>= 1; }
  }
  return count;
}

// ── Sphere Coverage Grid (10 rows × 8 cols = 80 sectors) ──

function SphereGrid({ mask }: { mask: number[] }) {
  const sectors: boolean[] = [];
  for (let row = 0; row < 10; row++) {
    const byte = mask[row] ?? 0;
    for (let bit = 0; bit < 8; bit++) {
      sectors.push((byte & (1 << bit)) !== 0);
    }
  }
  const covered = sectors.filter(Boolean).length;

  return (
    <div>
      <div className="grid grid-cols-8 gap-[1px]" style={{ width: 88 }}>
        {sectors.map((filled, i) => (
          <div
            key={i}
            className={cn(
              "w-[10px] h-[10px] transition-colors duration-200",
              filled ? "bg-accent-primary" : "bg-bg-tertiary"
            )}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono text-text-tertiary mt-1 block">
        {covered}/80 sectors
      </span>
    </div>
  );
}

// ── Fitness Gauge Bar ──────────────────────────────────────

function FitnessGauge({ fitness }: { fitness: number }) {
  // Gauge spans 0-40, clamped
  const maxVal = 40;
  const pct = Math.min(100, (fitness / maxVal) * 100);
  // Zone boundaries as percentages
  const greenEnd = (8 / maxVal) * 100;
  const yellowEnd = (16 / maxVal) * 100;

  return (
    <div className="w-full">
      <div className="relative h-3 w-full flex">
        <div className="h-full bg-status-success/40" style={{ width: `${greenEnd}%` }} />
        <div className="h-full bg-status-warning/40" style={{ width: `${yellowEnd - greenEnd}%` }} />
        <div className="h-full bg-status-error/40" style={{ width: `${100 - yellowEnd}%` }} />
        {/* Indicator dot */}
        <div
          className={cn("absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-bg-primary", fitnessBgColor(fitness))}
          style={{ left: `${Math.min(pct, 98)}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] font-mono text-text-tertiary">0</span>
        <span className="text-[8px] font-mono text-text-tertiary">8</span>
        <span className="text-[8px] font-mono text-text-tertiary">16</span>
        <span className="text-[8px] font-mono text-text-tertiary">40+</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export function CalibrationWizard({
  title,
  description,
  steps,
  currentStep,
  status,
  progress,
  statusMessage,
  waitingForConfirm,
  onConfirm,
  confirmLabel = "Confirm Position",
  compassProgress,
  compassResults,
  failureFixes,
  preTips,
  onStart,
  onCancel,
  onForceSave,
  unsupportedNotice,
  className,
}: CalibrationWizardProps) {
  const badge = statusBadge[status];

  return (
    <div className={cn("border border-border-default bg-bg-secondary p-4", className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
        </div>
        <span className={cn("text-[10px] font-mono px-2 py-0.5 shrink-0", badge.className)}>
          {badge.label}
        </span>
      </div>

      {/* Pre-calibration tips */}
      {preTips && preTips.length > 0 && status === "idle" && (
        <div className="mb-4 bg-bg-tertiary/50 px-3 py-2.5">
          <p className="text-[10px] font-medium text-text-secondary mb-1.5">Before you start</p>
          <ol className="space-y-1">
            {preTips.map((tip, i) => (
              <li key={i} className="text-[10px] text-text-tertiary flex gap-1.5">
                <span className="text-text-secondary shrink-0">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {steps.map((step, i) => {
            const isComplete = status === "success" || status === "waiting_accept" || status === "cal_warning" || (status === "in_progress" && i < currentStep);
            const isCurrent = status === "in_progress" && i === currentStep;
            const isFailed = status === "error" && i === currentStep;

            return (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {isComplete ? (
                    <CheckCircle size={14} className="text-status-success" />
                  ) : isFailed ? (
                    <XCircle size={14} className="text-status-error" />
                  ) : isCurrent ? (
                    <Loader2 size={14} className="text-accent-primary animate-spin" />
                  ) : (
                    <Circle size={14} className="text-text-tertiary" />
                  )}
                </div>
                <div>
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent ? "text-text-primary font-medium" : "text-text-secondary",
                    )}
                  >
                    {step.label}
                  </span>
                  {isCurrent && (
                    <p className="text-[10px] text-text-tertiary mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-compass progress bars with rotation hints and sphere coverage */}
      {compassProgress && compassProgress.length > 0 && status === "in_progress" && (
        <div className="mb-3 space-y-3">
          {compassProgress.map(({ compassId, completionPct, calStatus: cs, completionMask, direction }) => {
            const hint = getRotationHint(direction);
            const sectors = countSectors(completionMask);
            return (
              <div key={compassId}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-mono text-text-secondary">Compass {compassId}</span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    {calStatusText(cs)} — {Math.round(completionPct)}%
                  </span>
                </div>
                <div className="h-1.5 bg-bg-tertiary w-full">
                  <div
                    className="h-full bg-accent-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, completionPct))}%` }}
                  />
                </div>
                <div className="flex items-start justify-between gap-3 mt-1.5">
                  {/* Rotation hint */}
                  <div className="min-h-[16px]">
                    {hint && (
                      <span className="text-[10px] font-medium text-accent-primary">{hint}</span>
                    )}
                    <span className="text-[9px] font-mono text-text-tertiary ml-2">
                      {sectors}/80 sectors
                    </span>
                  </div>
                  {/* Sphere grid */}
                  {completionMask.length > 0 && <SphereGrid mask={completionMask} />}
                </div>
                {/* Live magnetometer vector display */}
                <div className="mt-1.5">
                  <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-1">Angular rate (rad/s)</p>
                  <div className="space-y-0.5">
                    {(["x", "y", "z"] as const).map((axis) => {
                      const val = direction[axis];
                      const pct = Math.min(100, (Math.abs(val) / 3.0) * 100);
                      const axisLabel = axis === "x" ? "Roll" : axis === "y" ? "Pitch" : "Yaw";
                      return (
                        <div key={axis} className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono text-text-tertiary w-7">{axisLabel}</span>
                          <div className="h-1 bg-bg-tertiary flex-1 relative">
                            <div
                              className={cn(
                                "h-full transition-all duration-150",
                                val > 0 ? "bg-accent-primary" : "bg-status-warning",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-text-tertiary w-10 text-right">
                            {val.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single progress bar (non-compass) */}
      {(!compassProgress || compassProgress.length === 0) && status === "in_progress" && progress !== undefined && !waitingForConfirm && (
        <div className="mb-3">
          <div className="h-1.5 bg-bg-tertiary w-full">
            <div
              className="h-full bg-accent-primary transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-tertiary mt-1 block">
            {Math.round(progress)}%
          </span>
        </div>
      )}

      {/* Compass calibration results — comprehensive cards */}
      {compassResults && compassResults.length > 0 && (
        <div className="mb-3 space-y-2">
          {compassResults.map((r) => {
            const mag = offsetMagnitude(r.ofsX, r.ofsY, r.ofsZ);
            const passed = r.calStatus === 4;
            const failed = r.calStatus >= 5;

            return (
              <div key={r.compassId} className="bg-bg-tertiary/50 px-3 py-2.5 space-y-2">
                {/* Header: compass ID + status + fitness label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-primary font-medium">
                      Compass {r.compassId}
                    </span>
                    {passed && <CheckCircle size={12} className="text-status-success" />}
                    {failed && <XCircle size={12} className="text-status-error" />}
                  </div>
                  <span className={cn("text-[10px] font-mono font-medium", fitnessColor(r.fitness))}>
                    {fitnessLabel(r.fitness)} ({r.fitness.toFixed(1)})
                  </span>
                </div>

                {/* Fitness gauge bar */}
                <FitnessGauge fitness={r.fitness} />

                {/* Hard-iron offsets */}
                <div>
                  <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Hard-iron offsets</p>
                  <div className={cn("text-[10px] font-mono", offsetColor(r.ofsX, r.ofsY, r.ofsZ))}>
                    X={r.ofsX.toFixed(1)} Y={r.ofsY.toFixed(1)} Z={r.ofsZ.toFixed(1)}
                    <span className="text-text-tertiary ml-1">(|{Math.round(mag)}|)</span>
                  </div>
                </div>

                {/* Soft-iron diagonal */}
                <div>
                  <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Soft-iron diagonal</p>
                  <div className="text-[10px] font-mono flex gap-2">
                    <span className={diagColor(r.diagX)}>X={r.diagX.toFixed(3)}</span>
                    <span className={diagColor(r.diagY)}>Y={r.diagY.toFixed(3)}</span>
                    <span className={diagColor(r.diagZ)}>Z={r.diagZ.toFixed(3)}</span>
                  </div>
                </div>

                {/* Soft-iron off-diagonal */}
                <div>
                  <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Soft-iron off-diagonal</p>
                  <div className="text-[10px] font-mono flex gap-2">
                    <span className={offdiagColor(r.offdiagX)}>X={r.offdiagX.toFixed(3)}</span>
                    <span className={offdiagColor(r.offdiagY)}>Y={r.offdiagY.toFixed(3)}</span>
                    <span className={offdiagColor(r.offdiagZ)}>Z={r.offdiagZ.toFixed(3)}</span>
                  </div>
                </div>

                {/* Orientation confidence */}
                {r.orientationConfidence > 0 && (
                  <div className="text-[10px] font-mono text-text-tertiary">
                    Orientation confidence: {(r.orientationConfidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {statusMessage && (
        <p
          className={cn(
            "text-[10px] font-mono mb-3",
            status === "error" ? "text-status-error" : (status === "waiting_accept" || status === "cal_warning") ? "text-status-warning" : "text-text-tertiary",
          )}
        >
          {statusMessage}
        </p>
      )}

      {/* Failure troubleshooting fixes */}
      {(status === "error" || status === "cal_warning") && failureFixes && failureFixes.length > 0 && (
        <div className={cn("mb-3 px-3 py-2.5 border", status === "cal_warning" ? "border-status-warning/20 bg-status-warning/5" : "border-status-error/20 bg-status-error/5")}>
          <p className={cn("text-[10px] font-medium mb-1.5", status === "cal_warning" ? "text-status-warning" : "text-status-error")}>Troubleshooting</p>
          <ul className="space-y-1">
            {failureFixes.map((fix, i) => (
              <li key={i} className="text-[10px] text-text-secondary flex gap-1.5">
                <span className="text-status-error shrink-0">&bull;</span>
                {fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unsupported notice */}
      {unsupportedNotice && status === "idle" && (
        <div className="mb-3 border border-status-warning/20 bg-status-warning/5 px-3 py-2.5">
          <p className="text-[10px] text-status-warning">{unsupportedNotice}</p>
        </div>
      )}

      <div className="flex gap-2">
        {status === "cal_warning" && onForceSave ? (
          <>
            <Button variant="primary" size="sm" onClick={onForceSave}>
              Force Save Offsets
            </Button>
            <Button variant="secondary" size="sm" onClick={onStart}>
              Retry
            </Button>
          </>
        ) : waitingForConfirm && onConfirm ? (
          <>
            <Button variant="primary" size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Button>
            {onCancel && (
              <Button variant="danger" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </>
        ) : status === "in_progress" && onCancel ? (
          <>
            <Button variant="secondary" size="sm" loading>
              Calibrating…
            </Button>
            <Button variant="danger" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : unsupportedNotice ? (
          <Button variant="secondary" size="sm" disabled>
            Not Available
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onStart}>
            {status === "success" ? "Re-calibrate" : status === "error" || status === "cal_warning" ? "Retry" : "Start"}
          </Button>
        )}
      </div>
    </div>
  );
}
