"use client";

import { useState, useCallback } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useDroneManager } from "@/stores/drone-manager";
import { useParamLabel } from "@/hooks/use-param-label";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useToast } from "@/components/ui/toast";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Move3D, Save, HardDrive, Crosshair, RotateCcw } from "lucide-react";

const GIMBAL_PARAMS: string[] = [];

const OPTIONAL_GIMBAL_PARAMS = [
  "MNT1_TYPE", "MNT1_PITCH_MIN", "MNT1_PITCH_MAX",
  "MNT1_ROLL_MIN", "MNT1_ROLL_MAX",
  "MNT1_YAW_MIN", "MNT1_YAW_MAX",
  "MNT1_RC_RATE", "MNT1_DEFLT_MODE",
];

const MNT_TYPE_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — Servo" },
  { value: "6", label: "6 — SToRM32 MAVLink" },
  { value: "7", label: "7 — Alexmos" },
  { value: "8", label: "8 — SiYi" },
  { value: "9", label: "9 — Scripting" },
];

const MNT_MODE_OPTIONS = [
  { value: "0", label: "0 — Retract" },
  { value: "1", label: "1 — Neutral" },
  { value: "2", label: "2 — MAVLink Targeting" },
  { value: "3", label: "3 — RC Targeting" },
  { value: "4", label: "4 — GPS Point" },
  { value: "5", label: "5 — SysID Target" },
  { value: "6", label: "6 — Home Location" },
];

export function GimbalPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const { label: pl } = useParamLabel();
  const [saving, setSaving] = useState(false);
  const [manualPitch, setManualPitch] = useState(0);
  const [manualYaw, setManualYaw] = useState(0);

  const gimbalBuffer = useTelemetryStore((s) => s.gimbal);
  const latestGimbal = gimbalBuffer.latest();

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: GIMBAL_PARAMS, optionalParams: OPTIONAL_GIMBAL_PARAMS, panelId: "gimbal" });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;
  const mountEnabled = (params.get("MNT1_TYPE") ?? 0) !== 0;

  const p = (name: string, fallback = "0") => String(params.get(name) ?? fallback);
  const set = (name: string, v: string) => setLocalValue(name, Number(v) || 0);

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

  const handleCenter = useCallback(() => {
    setManualPitch(0);
    setManualYaw(0);
  }, []);

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <PanelHeader
            title="Gimbal"
            subtitle="Mount type, axis limits, RC rate, and manual control"
            icon={<Move3D size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* Mount Configuration */}
          <Card icon={<Move3D size={14} />} title="Gimbal Configuration" description="Mount type and default behavior">
            <Select
              label={pl("MNT1_TYPE — Mount Type")}
              options={MNT_TYPE_OPTIONS}
              value={p("MNT1_TYPE")}
              onChange={(v) => set("MNT1_TYPE", v)}
            />
            {mountEnabled && (
              <Select
                label={pl("MNT1_DEFLT_MODE — Default Mode")}
                options={MNT_MODE_OPTIONS}
                value={p("MNT1_DEFLT_MODE", "3")}
                onChange={(v) => set("MNT1_DEFLT_MODE", v)}
              />
            )}
          </Card>

          {/* Axis Limits */}
          {mountEnabled && (
            <Card icon={<Move3D size={14} />} title="Axis Limits" description="Min/max angles for each axis">
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Pitch</span>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input
                      label="Min"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_PITCH_MIN", "-90")}
                      onChange={(e) => set("MNT1_PITCH_MIN", e.target.value)}
                    />
                    <Input
                      label="Max"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_PITCH_MAX", "0")}
                      onChange={(e) => set("MNT1_PITCH_MAX", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Roll</span>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input
                      label="Min"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_ROLL_MIN", "-45")}
                      onChange={(e) => set("MNT1_ROLL_MIN", e.target.value)}
                    />
                    <Input
                      label="Max"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_ROLL_MAX", "45")}
                      onChange={(e) => set("MNT1_ROLL_MAX", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Yaw</span>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input
                      label="Min"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_YAW_MIN", "-180")}
                      onChange={(e) => set("MNT1_YAW_MIN", e.target.value)}
                    />
                    <Input
                      label="Max"
                      type="number"
                      step="1"
                      unit="°"
                      value={p("MNT1_YAW_MAX", "180")}
                      onChange={(e) => set("MNT1_YAW_MAX", e.target.value)}
                    />
                  </div>
                </div>

                <Input
                  label={pl("MNT1_RC_RATE — RC Rate")}
                  type="number"
                  step="1"
                  min="0"
                  unit="deg/s"
                  value={p("MNT1_RC_RATE", "90")}
                  onChange={(e) => set("MNT1_RC_RATE", e.target.value)}
                />
              </div>
            </Card>
          )}

          {/* Live Gimbal Status */}
          {mountEnabled && latestGimbal && (
            <Card icon={<Crosshair size={14} />} title="Live Status" description="Current gimbal orientation">
              <div className="grid grid-cols-3 gap-3">
                <LiveStat label="Pitch" value={latestGimbal.pitch.toFixed(1)} unit="°" />
                <LiveStat label="Roll" value={latestGimbal.roll.toFixed(1)} unit="°" />
                <LiveStat label="Yaw" value={latestGimbal.yaw.toFixed(1)} unit="°" />
              </div>
            </Card>
          )}

          {/* Manual Control */}
          {mountEnabled && (
            <Card icon={<Move3D size={14} />} title="Manual Control" description="Direct gimbal control sliders">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">Pitch</span>
                    <span className="text-xs font-mono text-text-tertiary">{manualPitch}°</span>
                  </div>
                  <input
                    type="range"
                    min={Number(p("MNT1_PITCH_MIN", "-90"))}
                    max={Number(p("MNT1_PITCH_MAX", "0"))}
                    value={manualPitch}
                    onChange={(e) => setManualPitch(Number(e.target.value))}
                    className="w-full h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer accent-accent-primary"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">Yaw</span>
                    <span className="text-xs font-mono text-text-tertiary">{manualYaw}°</span>
                  </div>
                  <input
                    type="range"
                    min={Number(p("MNT1_YAW_MIN", "-180"))}
                    max={Number(p("MNT1_YAW_MAX", "180"))}
                    value={manualYaw}
                    onChange={(e) => setManualYaw(Number(e.target.value))}
                    className="w-full h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer accent-accent-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCenter}>
                    <RotateCcw size={12} className="mr-1" /> Center
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Save */}
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

function LiveStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="text-[10px] text-text-tertiary block">{label}</span>
      <span className="text-sm font-mono text-text-primary">
        {value}
        <span className="text-[10px] text-text-tertiary ml-0.5">{unit}</span>
      </span>
    </div>
  );
}
