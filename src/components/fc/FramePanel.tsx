"use client";

import { useState, useCallback, useMemo } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getMotorLayout,
  FRAME_CLASS_NAMES,
  FRAME_TYPE_NAMES,
  type FrameLayout,
  type MotorPosition,
} from "@/lib/motor-layouts";
import { Save, HardDrive, Box, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const FRAME_PARAMS = ["FRAME_CLASS", "FRAME_TYPE"];

const FRAME_CLASS_OPTIONS = Object.entries(FRAME_CLASS_NAMES).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const FRAME_TYPE_OPTIONS = Object.entries(FRAME_TYPE_NAMES).map(([value, label]) => ({
  value: Number(value),
  label,
}));

// ── Component ────────────────────────────────────────────────

export function FramePanel() {
  const { toast } = useToast();
  const { isLocked } = useArmedLock();

  const {
    params,
    loading,
    error,
    dirtyParams,
    hasRamWrites,
    loadProgress,
    hasLoaded,
    refresh,
    setLocalValue,
    saveAllToRam,
    commitToFlash,
  } = usePanelParams({
    paramNames: FRAME_PARAMS,
    panelId: "frame",
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

  // ── Derived state ──────────────────────────────────────────

  const frameClass = params.get("FRAME_CLASS") ?? 1;
  const frameType = params.get("FRAME_TYPE") ?? 1;
  const hasDirty = dirtyParams.size > 0;

  const layout = useMemo(
    () => getMotorLayout(frameClass, frameType),
    [frameClass, frameType],
  );

  const className = FRAME_CLASS_NAMES[frameClass] ?? "Unknown";
  const typeName = FRAME_TYPE_NAMES[frameType] ?? "Unknown";
  const motorCount = layout?.motors.length ?? 0;

  // ── Save / Flash ───────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) {
      toast("Frame parameters saved to RAM", "success");
    } else {
      toast("Failed to save frame parameters", "error");
    }
  }, [saveAllToRam, toast]);

  const handleFlash = useCallback(async () => {
    setCommitting(true);
    const ok = await commitToFlash();
    setCommitting(false);
    if (ok) {
      toast("Written to flash — persists after reboot", "success");
    } else {
      toast("Failed to write to flash", "error");
    }
  }, [commitToFlash, toast]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <PanelHeader
            title="Frame Configuration"
            subtitle="Vehicle frame class, type, and motor layout"
            icon={<Box size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={true}
            error={error}
          />

          {/* Frame Class & Type */}
          <Card icon={<Box size={14} />} title="Frame Selection" description="Select airframe class and configuration type">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">FRAME_CLASS</label>
                <select
                  value={String(frameClass)}
                  onChange={(e) => setLocalValue("FRAME_CLASS", Number(e.target.value))}
                  disabled={isLocked}
                  className="h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary"
                >
                  {FRAME_CLASS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.value} — {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">FRAME_TYPE</label>
                <select
                  value={String(frameType)}
                  onChange={(e) => setLocalValue("FRAME_TYPE", Number(e.target.value))}
                  disabled={isLocked}
                  className="h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary"
                >
                  {FRAME_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.value} — {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Motor Layout Diagram */}
          <Card icon={<Zap size={14} />} title="Motor Layout" description={`${className} ${typeName} — ${motorCount} motors`}>
            {layout ? (
              <MotorDiagram layout={layout} />
            ) : (
              <div className="text-xs text-text-tertiary py-4 text-center">
                No layout data for {className} {typeName}
              </div>
            )}
          </Card>

          {/* Info Row */}
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <div>
              <span className="text-text-tertiary">Motors: </span>
              <span className="font-mono text-text-primary">{motorCount}</span>
            </div>
            <div>
              <span className="text-text-tertiary">Class: </span>
              <span className="font-mono text-text-primary">{className}</span>
            </div>
            <div>
              <span className="text-text-tertiary">Type: </span>
              <span className="font-mono text-text-primary">{typeName}</span>
            </div>
          </div>

          {/* Save / Flash */}
          <div className="flex items-center gap-3 pt-2 pb-4">
            <Button
              variant="primary"
              size="lg"
              icon={<Save size={14} />}
              disabled={!hasDirty || isLocked}
              loading={saving}
              onClick={handleSave}
            >
              Save to RAM
            </Button>
            {hasRamWrites && (
              <Button
                variant="secondary"
                size="lg"
                icon={<HardDrive size={14} />}
                loading={committing}
                onClick={handleFlash}
              >
                Write to Flash
              </Button>
            )}
            {hasDirty && (
              <span className="text-[10px] text-status-warning">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>
    </ArmedLockOverlay>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent-primary">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * SVG motor layout diagram.
 * Positions motors using roll/pitch coefficients from the layout data.
 * Roll → X axis (right = positive), Pitch → Y axis (up = positive, SVG inverted).
 */
function MotorDiagram({ layout }: { layout: FrameLayout }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 140; // coefficient range is roughly -0.5 to 0.5
  const motorRadius = 14;

  return (
    <div className="flex justify-center py-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Center cross (vehicle body) */}
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="var(--text-tertiary)" strokeWidth={1} />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="var(--text-tertiary)" strokeWidth={1} />

        {/* Forward arrow */}
        <polygon
          points={`${cx},${cy - 70} ${cx - 5},${cy - 60} ${cx + 5},${cy - 60}`}
          fill="var(--text-tertiary)"
          opacity={0.5}
        />

        {/* Motor arms + circles */}
        {layout.motors.map((motor) => {
          const mx = cx + motor.roll * scale;
          const my = cy - motor.pitch * scale; // invert Y for SVG
          const isCW = motor.rotation === "CW";

          return (
            <g key={motor.number}>
              {/* Arm line */}
              <line
                x1={cx}
                y1={cy}
                x2={mx}
                y2={my}
                stroke="var(--border-default)"
                strokeWidth={1.5}
              />
              {/* Motor circle */}
              <circle
                cx={mx}
                cy={my}
                r={motorRadius}
                fill={isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"}
                opacity={0.15}
                stroke={isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"}
                strokeWidth={1.5}
              />
              {/* Rotation indicator arc */}
              <path
                d={rotationArc(mx, my, motorRadius - 3, isCW)}
                fill="none"
                stroke={isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"}
                strokeWidth={1}
                opacity={0.6}
                markerEnd="none"
              />
              {/* Motor number */}
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--text-primary)"
              >
                {motor.number}
              </text>
              {/* CW/CCW label */}
              <text
                x={mx}
                y={my + motorRadius + 8}
                textAnchor="middle"
                fontSize={7}
                fontFamily="var(--font-mono)"
                fill="var(--text-tertiary)"
              >
                {motor.rotation}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Generate a small arc path for CW/CCW rotation indicator. */
function rotationArc(cx: number, cy: number, r: number, clockwise: boolean): string {
  const startAngle = clockwise ? -60 : 60;
  const endAngle = clockwise ? 180 : -180;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const sweep = clockwise ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 1 ${sweep} ${x2} ${y2}`;
}
