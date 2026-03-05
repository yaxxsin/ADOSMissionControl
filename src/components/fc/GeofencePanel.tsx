"use client";

import { useState, useCallback } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useParamLabel } from "@/hooks/use-param-label";
import { useParamMetadataMap } from "@/hooks/use-param-metadata";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import { useGeofenceStore } from "@/stores/geofence-store";
import { Shield, HardDrive, Save, MapPin, ArrowUp, Circle, Download, Upload, Plus, Trash2, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParamLabel } from "./ParamLabel";

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
  { value: "0", label: "0 — Report Only" },
  { value: "1", label: "1 — RTL or Land" },
  { value: "2", label: "2 — Always Land" },
  { value: "3", label: "3 — Brake (Auto)" },
  { value: "4", label: "4 — SmartRTL or RTL" },
  { value: "5", label: "5 — SmartRTL or Land" },
];

// ── Component ────────────────────────────────────────────────

export function GeofencePanel() {
  const { toast } = useToast();
  const { isLocked } = useArmedLock();
  const { label: pl } = useParamLabel();
  const paramMeta = useParamMetadataMap();
  const lbl = (raw: string) => <ParamLabel label={pl(raw)} metadata={paramMeta} />;

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
    autoLoad: true,
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Geofence store for zones and protocol operations
  const zones = useGeofenceStore((s) => s.zones);
  const addZone = useGeofenceStore((s) => s.addZone);
  const removeZone = useGeofenceStore((s) => s.removeZone);
  const toggleZoneRole = useGeofenceStore((s) => s.toggleZoneRole);
  const uploadFence = useGeofenceStore((s) => s.uploadFence);
  const downloadFence = useGeofenceStore((s) => s.downloadFence);
  const uploadState = useGeofenceStore((s) => s.uploadState);
  const downloadState = useGeofenceStore((s) => s.downloadState);
  const breachStatus = useGeofenceStore((s) => s.breachStatus);
  const breachCount = useGeofenceStore((s) => s.breachCount);
  const breachType = useGeofenceStore((s) => s.breachType);

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

  const handleUpload = useCallback(async () => {
    await uploadFence();
    toast("Fence points uploaded to FC", "success");
  }, [uploadFence, toast]);

  const handleDownload = useCallback(async () => {
    await downloadFence();
    toast("Fence points downloaded from FC", "success");
  }, [downloadFence, toast]);

  // ── Breach label ───────────────────────────────────────────

  const breachLabel = breachType === 0
    ? "None"
    : breachType === 1
      ? "Min Altitude"
      : breachType === 2
        ? "Max Altitude"
        : "Boundary";

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
              <label className="text-xs text-text-secondary">{pl("FENCE_ENABLE")}</label>
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
                label={lbl("FENCE_RADIUS — Max Radius")}
                value={fenceRadius}
                unit="m"
                min={0}
                step={10}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_RADIUS", v)}
              />
              <ParamInput
                label={lbl("FENCE_MARGIN — Warning Margin")}
                value={fenceMargin}
                unit="m"
                min={0}
                step={1}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_MARGIN", v)}
              />
            </Card>
          )}

          {/* Altitude Fence with visual band */}
          {hasAltFence && (
            <Card icon={<ArrowUp size={14} />} title="Altitude Fence" description="Altitude ceiling and floor">
              <ParamInput
                label={lbl("FENCE_ALT_MAX — Max Altitude")}
                value={fenceAltMax}
                unit="m"
                min={0}
                step={5}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_ALT_MAX", v)}
              />
              <ParamInput
                label={lbl("FENCE_ALT_MIN — Min Altitude")}
                value={fenceAltMin}
                unit="m"
                min={-100}
                step={0.5}
                disabled={isLocked}
                onChange={(v) => setLocalValue("FENCE_ALT_MIN", v)}
              />

              {/* Altitude band visualization */}
              <AltitudeBandViz altMin={fenceAltMin} altMax={fenceAltMax} />
            </Card>
          )}

          {/* Polygon Status */}
          {hasPolygonFence && (
            <Card icon={<MapPin size={14} />} title="Polygon Fence" description="Polygon boundary fence">
              <div className="text-xs text-text-secondary">
                Polygon vertices: <span className="font-mono text-text-primary">{fenceTotal}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleUpload}
                  disabled={isLocked}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border-default transition-colors",
                    isLocked ? "opacity-50 cursor-not-allowed" : "text-text-primary hover:bg-bg-tertiary cursor-pointer",
                  )}
                >
                  <Upload size={10} />
                  {uploadState === "uploading" ? "Uploading..." : "Upload Points"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border-default text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
                >
                  <Download size={10} />
                  {downloadState === "downloading" ? "Downloading..." : "Download Points"}
                </button>
              </div>
              {uploadState === "uploaded" && (
                <p className="text-[10px] font-mono text-status-success mt-1">Fence points uploaded</p>
              )}
              {downloadState === "downloaded" && (
                <p className="text-[10px] font-mono text-status-success mt-1">Fence points downloaded</p>
              )}
            </Card>
          )}

          {/* Inclusion/Exclusion Zones */}
          <Card icon={<MapPin size={14} />} title="Zones" description="Inclusion (must stay inside) and exclusion (must stay outside) zones">
            {zones.length === 0 && (
              <p className="text-[10px] text-text-tertiary">No zones defined. Add zones using the buttons below.</p>
            )}
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between py-1.5 border-b border-border-default last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      zone.role === "inclusion" ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                  <span className="text-xs text-text-primary font-mono">
                    {zone.role === "inclusion" ? "INCL" : "EXCL"} {zone.type}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {zone.type === "polygon"
                      ? `${zone.polygonPoints.length} pts`
                      : `${Math.round(zone.circleRadius)}m`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleZoneRole(zone.id)}
                    disabled={isLocked}
                    className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                    title="Toggle inclusion/exclusion"
                  >
                    <ToggleLeft size={12} />
                  </button>
                  <button
                    onClick={() => removeZone(zone.id)}
                    disabled={isLocked}
                    className="p-1 text-text-tertiary hover:text-status-error transition-colors"
                    title="Remove zone"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  addZone({
                    role: "inclusion",
                    type: "polygon",
                    polygonPoints: [],
                    circleCenter: null,
                    circleRadius: 100,
                  })
                }
                disabled={isLocked}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors",
                  "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
                  isLocked && "opacity-50 cursor-not-allowed",
                )}
              >
                <Plus size={10} />
                Inclusion
              </button>
              <button
                onClick={() =>
                  addZone({
                    role: "exclusion",
                    type: "polygon",
                    polygonPoints: [],
                    circleCenter: null,
                    circleRadius: 100,
                  })
                }
                disabled={isLocked}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors",
                  "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
                  isLocked && "opacity-50 cursor-not-allowed",
                )}
              >
                <Plus size={10} />
                Exclusion
              </button>
            </div>
          </Card>

          {/* Breach Action */}
          <Card icon={<Shield size={14} />} title="Breach Action" description="Action taken when fence is breached">
            <Select
              label={lbl("FENCE_ACTION")}
              options={FENCE_ACTION_OPTIONS}
              value={String(fenceAction)}
              onChange={(v) => setLocalValue("FENCE_ACTION", Number(v))}
              disabled={isLocked}
            />
          </Card>

          {/* Breach Status */}
          {breachStatus > 0 && (
            <Card icon={<Shield size={14} />} title="Breach Active" description="Current fence breach information">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-status-error animate-pulse" />
                <div>
                  <p className="text-xs text-status-error font-medium">Breach: {breachLabel}</p>
                  <p className="text-[10px] text-text-tertiary font-mono">
                    Total breaches: {breachCount}
                  </p>
                </div>
              </div>
            </Card>
          )}

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
  label: React.ReactNode;
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

/** Visual altitude band showing the valid flight altitude range */
function AltitudeBandViz({ altMin, altMax }: { altMin: number; altMax: number }) {
  // Clamp for display
  const displayMax = Math.max(altMax, 10);
  const displayMin = Math.max(altMin, 0);
  const range = displayMax - displayMin;

  // Scale: bar height represents 0 to altMax
  const BAR_HEIGHT = 80;
  const minPct = displayMax > 0 ? (displayMin / displayMax) * 100 : 0;
  const bandPct = displayMax > 0 ? (range / displayMax) * 100 : 100;

  return (
    <div className="flex items-start gap-3 mt-2">
      {/* Vertical bar */}
      <div className="relative" style={{ width: 24, height: BAR_HEIGHT }}>
        {/* Background (danger zone) */}
        <div
          className="absolute inset-0 bg-red-500/15 border border-red-500/20"
          style={{ borderRadius: 2 }}
        />
        {/* Valid altitude band (green) */}
        <div
          className="absolute left-0 right-0 bg-green-500/25 border-l-2 border-green-500"
          style={{
            bottom: `${minPct}%`,
            height: `${bandPct}%`,
            borderRadius: 1,
          }}
        />
        {/* Max altitude line */}
        <div
          className="absolute left-0 right-0 h-px bg-red-500"
          style={{ bottom: `${100}%`, transform: "translateY(1px)" }}
        />
      </div>

      {/* Labels */}
      <div className="flex flex-col justify-between" style={{ height: BAR_HEIGHT }}>
        <div className="text-[10px] font-mono text-red-400">
          {altMax}m MAX
        </div>
        <div className="text-[10px] font-mono text-green-400">
          Valid: {displayMin}m - {altMax}m
        </div>
        <div className="text-[10px] font-mono text-text-tertiary">
          {altMin > 0 ? `${altMin}m MIN` : "0m GND"}
        </div>
      </div>
    </div>
  );
}
