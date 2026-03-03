"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getMotorLayout,
  getTypesForClass,
  FRAME_CLASS_NAMES,
  FRAME_TYPE_DESCRIPTIONS,
  type FrameLayout,
  type MotorPosition,
} from "@/lib/motor-layouts";
import { Select } from "@/components/ui/select";
import { Save, HardDrive, Box, Zap } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const FRAME_PARAMS = ["FRAME_CLASS", "FRAME_TYPE"];

const FRAME_CLASS_OPTIONS = Object.entries(FRAME_CLASS_NAMES).map(([value, label]) => ({
  value: String(Number(value)),
  label: `${Number(value)} — ${label}`,
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

  // Filtered type options for the selected class
  const frameTypeOptions = useMemo(() => {
    const types = getTypesForClass(frameClass);
    if (types.length === 0) {
      // Fallback: show all known types if class has no layout data
      return [{ value: "0", label: "0 — Plus" }];
    }
    return types.map(({ value, name }) => ({
      value: String(value),
      label: `${value} — ${name}`,
    }));
  }, [frameClass]);

  // Auto-reset FRAME_TYPE when the selected class changes and current type is invalid
  useEffect(() => {
    const validTypes = getTypesForClass(frameClass);
    if (validTypes.length > 0 && !validTypes.some((t) => t.value === frameType)) {
      setLocalValue("FRAME_TYPE", validTypes[0].value);
    }
  }, [frameClass, frameType, setLocalValue]);

  const layout = useMemo(
    () => getMotorLayout(frameClass, frameType),
    [frameClass, frameType],
  );

  const className = FRAME_CLASS_NAMES[frameClass] ?? "Unknown";
  const typeName = layout?.typeName ?? "Unknown";
  const motorCount = layout?.motors.length ?? 0;
  const typeDescription = FRAME_TYPE_DESCRIPTIONS[frameType];

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
              <Select
                label="FRAME_CLASS"
                options={FRAME_CLASS_OPTIONS}
                value={String(frameClass)}
                onChange={(v) => setLocalValue("FRAME_CLASS", Number(v))}
                disabled={isLocked}
              />
              <Select
                label="FRAME_TYPE"
                options={frameTypeOptions}
                value={String(frameType)}
                onChange={(v) => setLocalValue("FRAME_TYPE", Number(v))}
                disabled={isLocked}
              />
            </div>
            {typeDescription && (
              <p className="text-[10px] text-text-tertiary mt-2">
                {typeDescription}
              </p>
            )}
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
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const motorRadius = 14;

  // Compute scale from the actual motor position range
  const maxCoord = layout.motors.reduce(
    (max, m) => Math.max(max, Math.abs(m.roll), Math.abs(m.pitch)),
    0.5,
  );
  const scale = (size / 2 - motorRadius - 30) / maxCoord;

  // Check if any motors have unknown rotation
  const hasUnknown = layout.motors.some((m) => m.rotation === "?");

  // Detect if this is a yaw servo (Tri motor 7 at center)
  const isTriWithServo = layout.frameClass === 7;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arrowhead markers */}
        <defs>
          <marker id="arrow-cw" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="var(--accent-primary)" />
          </marker>
          <marker id="arrow-ccw" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="var(--accent-secondary, var(--accent-primary))" />
          </marker>
        </defs>

        {/* Center body outline */}
        <rect
          x={cx - 16} y={cy - 16} width={32} height={32} rx={6}
          fill="var(--bg-tertiary)" stroke="var(--border-default)" strokeWidth={1}
        />

        {/* Forward indicator */}
        <text
          x={cx} y={cy - scale * maxCoord - 18}
          textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)"
          fill="var(--text-tertiary)"
        >
          FWD
        </text>
        <polygon
          points={`${cx},${cy - scale * maxCoord - 8} ${cx - 4},${cy - scale * maxCoord - 1} ${cx + 4},${cy - scale * maxCoord - 1}`}
          fill="var(--text-tertiary)"
          opacity={0.6}
        />

        {/* Motor arms + circles */}
        {layout.motors.map((motor) => {
          const mx = cx + motor.roll * scale;
          const my = cy - motor.pitch * scale;
          const isUnknown = motor.rotation === "?";
          const isCW = motor.rotation === "CW";
          const isServo = isTriWithServo && motor.number === 7;

          // Servo at center: render differently
          if (isServo) {
            return (
              <g key={`servo-${motor.number}`}>
                <rect
                  x={mx - 8} y={my - 6} width={16} height={12} rx={2}
                  fill="var(--bg-tertiary)"
                  stroke="var(--text-tertiary)"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
                <text
                  x={mx} y={my + 1}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={7} fontFamily="var(--font-mono)"
                  fill="var(--text-tertiary)"
                >
                  SRV
                </text>
                {/* Test order badge */}
                <circle cx={mx - 12} cy={my + 10} r={6} fill="var(--bg-tertiary)" stroke="var(--border-default)" strokeWidth={0.5} />
                <text
                  x={mx - 12} y={my + 10}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={7} fontFamily="var(--font-mono)" fill="var(--text-tertiary)"
                >
                  {motor.testOrder}
                </text>
              </g>
            );
          }

          return (
            <g key={motor.number} opacity={isUnknown ? 0.7 : 1}>
              {/* Arm line */}
              <line
                x1={cx} y1={cy} x2={mx} y2={my}
                stroke="var(--border-default)" strokeWidth={1.5}
              />
              {/* Motor circle */}
              <circle
                cx={mx} cy={my} r={motorRadius}
                fill={isUnknown
                  ? "var(--bg-tertiary)"
                  : isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"
                }
                opacity={isUnknown ? 0.3 : 0.15}
                stroke={isUnknown
                  ? "var(--text-tertiary)"
                  : isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"
                }
                strokeWidth={1.5}
                strokeDasharray={isUnknown ? "3 2" : "none"}
              />
              {/* Rotation indicator arc (skip for unknown) */}
              {!isUnknown && (
                <path
                  d={rotationArc(mx, my, motorRadius - 3, isCW)}
                  fill="none"
                  stroke={isCW ? "var(--accent-primary)" : "var(--accent-secondary, var(--accent-primary))"}
                  strokeWidth={1}
                  opacity={0.6}
                  markerEnd={isCW ? "url(#arrow-cw)" : "url(#arrow-ccw)"}
                />
              )}
              {/* Motor number */}
              <text
                x={mx} y={my}
                textAnchor="middle" dominantBaseline="central"
                fontSize={10} fontFamily="var(--font-mono)"
                fill="var(--text-primary)"
              >
                {motor.number}
              </text>
              {/* CW/CCW label */}
              <text
                x={mx} y={my + motorRadius + 8}
                textAnchor="middle" fontSize={7} fontFamily="var(--font-mono)"
                fill="var(--text-tertiary)"
              >
                {motor.rotation}
              </text>
              {/* Test order badge */}
              <circle
                cx={mx - motorRadius + 2} cy={my + motorRadius + 2}
                r={6} fill="var(--bg-tertiary)" stroke="var(--border-default)" strokeWidth={0.5}
              />
              <text
                x={mx - motorRadius + 2} y={my + motorRadius + 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={7} fontFamily="var(--font-mono)" fill="var(--text-tertiary)"
              >
                {motor.testOrder}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent-primary" /> CW
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-secondary, var(--accent-primary))" }} /> CCW
        </span>
        {hasUnknown && (
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--bg-tertiary)", border: "1px dashed var(--text-tertiary)" }}
            /> Unknown
          </span>
        )}
        <span className="flex items-center gap-1">
          <span
            className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[6px] font-mono"
            style={{ background: "var(--bg-tertiary)", border: "0.5px solid var(--border-default)" }}
          >
            n
          </span>
          Test order
        </span>
      </div>
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
