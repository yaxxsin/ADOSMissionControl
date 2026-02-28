"use client";

import { useState, useCallback, useMemo } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Shield, HardDrive, Save, MapPin, ArrowUp, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const FENCE_PARAMS = [
  "FENCE_ENABLE",
  "FENCE_TYPE",
  "FENCE_ALT_MAX",
  "FENCE_ALT_MIN",
  "FENCE_RADIUS",
  "FENCE_MARGIN",
  "FENCE_ACTION",
  "FENCE_TOTAL",
];

/** FENCE_TYPE bitmask: bit 0 = max altitude, bit 1 = circle, bit 2 = polygon */
const FENCE_TYPE_BITS = {
  ALT_MAX: 1 << 0,
  CIRCLE: 1 << 1,
  POLYGON: 1 << 2,
} as const;

const FENCE_ACTION_OPTIONS = [
  { value: 0, label: "Report Only" },
  { value: 1, label: "RTL or Land" },
  { value: 2, label: "Always Land" },
  { value: 3, label: "Brake (Auto)" },
  { value: 4, label: "SmartRTL or RTL" },
  { value: 5, label: "SmartRTL or Land" },
];

// ── Component ────────────────────────────────────────────────

export function GeofencePanel() {
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
    paramNames: FENCE_PARAMS,
    panelId: "geofence",
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

  // ── Derived state ──────────────────────────────────────────

  const fenceEnable = params.get("FENCE_ENABLE") ?? 0;
  const fenceType = params.get("FENCE_TYPE") ?? 0;
  const fenceAction = params.get("FENCE_ACTION") ?? 0;
  const fenceAltMax = params.get("FENCE_ALT_MAX") ?? 100;
  const fenceAltMin = params.get("FENCE_ALT_MIN") ?? 0;
  const fenceRadius = params.get("FENCE_RADIUS") ?? 300;
  const fenceMargin = params.get("FENCE_MARGIN") ?? 2;
  const fenceTotal = params.get("FENCE_TOTAL") ?? 0;

  const hasAltFence = (fenceType & FENCE_TYPE_BITS.ALT_MAX) !== 0;
  const hasCircleFence = (fenceType & FENCE_TYPE_BITS.CIRCLE) !== 0;
  const hasPolygonFence = (fenceType & FENCE_TYPE_BITS.POLYGON) !== 0;

  const hasDirty = dirtyParams.size > 0;

  // ── Fence type toggle ──────────────────────────────────────

  const toggleFenceTypeBit = useCallback(
    (bit: number) => {
      const current = params.get("FENCE_TYPE") ?? 0;
      setLocalValue("FENCE_TYPE", current ^ bit);
    },
    [params, setLocalValue],
  );

  // ── Save / Flash ───────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) {
      toast("Geofence parameters saved to RAM", "success");
    } else {
      toast("Failed to save some parameters", "error");
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
            title="Geofence Configuration"
            subtitle="Configure geographical boundary enforcement and breach actions"
            icon={<Shield size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={true}
            error={error}
          />

          {/* Enable */}
          <Card icon={<Shield size={14} />} title="Geofence Enable" description="Master enable for fence enforcement">
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-secondary">FENCE_ENABLE</label>
              <button
                onClick={() => setLocalValue("FENCE_ENABLE", fenceEnable ? 0 : 1)}
                disabled={isLocked}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-colors",
                  fenceEnable ? "bg-accent-primary" : "bg-bg-tertiary border border-border-default",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    fenceEnable ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
              <span className="text-[10px] font-mono text-text-tertiary">
                {fenceEnable ? "ENABLED" : "DISABLED"}
              </span>
            </div>
          </Card>

          {/* Fence Type */}
          <Card icon={<MapPin size={14} />} title="Fence Type" description="Select which fence boundaries to enforce (bitmask)">
            <div className="flex gap-2">
              <FenceTypeChip
                label="Altitude"
                icon={<ArrowUp size={10} />}
                active={hasAltFence}
                onClick={() => toggleFenceTypeBit(FENCE_TYPE_BITS.ALT_MAX)}
                disabled={isLocked}
              />
              <FenceTypeChip
                label="Circle"
                icon={<Circle size={10} />}
                active={hasCircleFence}
                onClick={() => toggleFenceTypeBit(FENCE_TYPE_BITS.CIRCLE)}
                disabled={isLocked}
              />
              <FenceTypeChip
                label="Polygon"
                icon={<MapPin size={10} />}
                active={hasPolygonFence}
                onClick={() => toggleFenceTypeBit(FENCE_TYPE_BITS.POLYGON)}
                disabled={isLocked}
              />
            </div>
            <p className="text-[10px] font-mono text-text-tertiary mt-1">
              FENCE_TYPE = {fenceType} (0x{fenceType.toString(16).padStart(2, "0")})
            </p>
          </Card>

          {/* Circle Fence */}
          {hasCircleFence && (
            <Card icon={<Circle size={14} />} title="Circle Fence" description="Maximum horizontal distance from home">
              <ParamInput
                label="FENCE_RADIUS — Max Radius"
                value={fenceRadius}
                unit="m"
                min={0}
                step={10}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_RADIUS", v)}
              />
              <ParamInput
                label="FENCE_MARGIN — Warning Margin"
                value={fenceMargin}
                unit="m"
                min={0}
                step={1}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_MARGIN", v)}
              />
            </Card>
          )}

          {/* Altitude Fence */}
          {hasAltFence && (
            <Card icon={<ArrowUp size={14} />} title="Altitude Fence" description="Altitude ceiling and floor">
              <ParamInput
                label="FENCE_ALT_MAX — Max Altitude"
                value={fenceAltMax}
                unit="m"
                min={0}
                step={5}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_ALT_MAX", v)}
              />
              <ParamInput
                label="FENCE_ALT_MIN — Min Altitude"
                value={fenceAltMin}
                unit="m"
                min={-100}
                step={0.5}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_ALT_MIN", v)}
              />
            </Card>
          )}

          {/* Polygon Status */}
          {hasPolygonFence && (
            <Card icon={<MapPin size={14} />} title="Polygon Fence" description="Polygon boundary fence">
              <div className="text-xs text-text-secondary">
                Polygon vertices: <span className="font-mono text-text-primary">{fenceTotal}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">
                Upload polygon fence points via MAVLink FENCE_POINT messages or mission planner
              </p>
            </Card>
          )}

          {/* Breach Action */}
          <Card icon={<Shield size={14} />} title="Breach Action" description="Action taken when fence is breached">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary">FENCE_ACTION</label>
              <select
                value={String(fenceAction)}
                onChange={(e) => setLocalValue("FENCE_ACTION", Number(e.target.value))}
                disabled={isLocked}
                className="h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary"
              >
                {FENCE_ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.value} — {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>

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

function FenceTypeChip({
  label,
  icon,
  active,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors",
        active
          ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
          : "bg-bg-tertiary border-border-default text-text-tertiary hover:text-text-secondary",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ParamInput({
  label,
  value,
  unit,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
        />
        <span className="text-[10px] text-text-tertiary">{unit}</span>
      </div>
    </div>
  );
}
