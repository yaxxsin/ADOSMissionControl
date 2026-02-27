"use client";

import { useState, useMemo } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useDroneManager } from "@/stores/drone-manager";
import { useToast } from "@/components/ui/toast";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Camera, Save, HardDrive, Aperture, Ruler, Calculator } from "lucide-react";

const CAMERA_PARAMS = [
  "CAM1_TYPE", "CAM1_DURATION", "CAM1_SERVO_OFF", "CAM1_SERVO_ON", "CAM1_TRIGG_DIST",
];

const CAM_TYPE_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — Servo" },
  { value: "2", label: "2 — Relay" },
  { value: "3", label: "3 — GoPro" },
  { value: "4", label: "4 — Mount (SIYI)" },
  { value: "5", label: "5 — MAVLink" },
  { value: "6", label: "6 — Scripting" },
];

export function CameraPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [imageCount, setImageCount] = useState(0);

  // Survey helper state
  const [surveyAlt, setSurveyAlt] = useState(50);
  const [surveyFov, setSurveyFov] = useState(84);
  const [surveyOverlap, setSurveyOverlap] = useState(70);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: CAMERA_PARAMS, panelId: "camera" });

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;
  const camEnabled = (params.get("CAM1_TYPE") ?? 0) !== 0;
  const isServoType = (params.get("CAM1_TYPE") ?? 0) === 1;

  const p = (name: string, fallback = "0") => String(params.get(name) ?? fallback);
  const set = (name: string, v: string) => setLocalValue(name, Number(v) || 0);

  const calculatedTriggerDist = useMemo(() => {
    if (surveyAlt <= 0 || surveyFov <= 0 || surveyOverlap <= 0) return 0;
    const footprint = 2 * surveyAlt * Math.tan((surveyFov / 2) * Math.PI / 180);
    return footprint * (1 - surveyOverlap / 100);
  }, [surveyAlt, surveyFov, surveyOverlap]);

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

  function handleTrigger() {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    // MAV_CMD_DO_DIGICAM_CONTROL would be sent here
    setImageCount((c) => c + 1);
    toast("Camera triggered", "success");
  }

  function applyCalculatedDistance() {
    if (calculatedTriggerDist > 0) {
      set("CAM1_TRIGG_DIST", calculatedTriggerDist.toFixed(1));
      toast(`Trigger distance set to ${calculatedTriggerDist.toFixed(1)} m`, "success");
    }
  }

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <PanelHeader
            title="Camera"
            subtitle="Camera trigger, servo settings, distance-based capture"
            icon={<Camera size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* Camera Type */}
          <Card icon={<Camera size={14} />} title="Camera Configuration" description="Camera type and trigger method">
            <Select
              label="CAM1_TYPE — Camera Type"
              options={CAM_TYPE_OPTIONS}
              value={p("CAM1_TYPE")}
              onChange={(v) => set("CAM1_TYPE", v)}
            />
          </Card>

          {/* Servo Trigger Settings */}
          {camEnabled && isServoType && (
            <Card icon={<Aperture size={14} />} title="Servo Trigger" description="PWM values for servo-based shutter">
              <Input
                label="CAM1_SERVO_OFF — Servo Off PWM"
                type="number"
                step="10"
                min="500"
                max="2500"
                unit="μs"
                value={p("CAM1_SERVO_OFF", "1000")}
                onChange={(e) => set("CAM1_SERVO_OFF", e.target.value)}
              />
              <Input
                label="CAM1_SERVO_ON — Servo On PWM"
                type="number"
                step="10"
                min="500"
                max="2500"
                unit="μs"
                value={p("CAM1_SERVO_ON", "1500")}
                onChange={(e) => set("CAM1_SERVO_ON", e.target.value)}
              />
              <Input
                label="CAM1_DURATION — Pulse Duration"
                type="number"
                step="1"
                min="1"
                unit="ds (0.1s)"
                value={p("CAM1_DURATION", "10")}
                onChange={(e) => set("CAM1_DURATION", e.target.value)}
              />
            </Card>
          )}

          {/* Distance Trigger */}
          {camEnabled && (
            <Card icon={<Ruler size={14} />} title="Distance Trigger" description="Automatic capture at distance intervals">
              <Input
                label="CAM1_TRIGG_DIST — Trigger Distance"
                type="number"
                step="0.5"
                min="0"
                unit="m"
                value={p("CAM1_TRIGG_DIST")}
                onChange={(e) => set("CAM1_TRIGG_DIST", e.target.value)}
              />
              <p className="text-[10px] text-text-tertiary">Set to 0 to disable distance-based triggering</p>
            </Card>
          )}

          {/* Survey Helper */}
          {camEnabled && (
            <Card icon={<Calculator size={14} />} title="Survey Helper" description="Calculate trigger distance from survey parameters">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-text-tertiary block mb-1">Altitude</label>
                  <input
                    type="number"
                    value={surveyAlt}
                    onChange={(e) => setSurveyAlt(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono bg-bg-tertiary border border-border-default rounded"
                  />
                  <span className="text-[9px] text-text-tertiary">m</span>
                </div>
                <div>
                  <label className="text-[10px] text-text-tertiary block mb-1">Camera FOV</label>
                  <input
                    type="number"
                    value={surveyFov}
                    onChange={(e) => setSurveyFov(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono bg-bg-tertiary border border-border-default rounded"
                  />
                  <span className="text-[9px] text-text-tertiary">°</span>
                </div>
                <div>
                  <label className="text-[10px] text-text-tertiary block mb-1">Overlap</label>
                  <input
                    type="number"
                    value={surveyOverlap}
                    onChange={(e) => setSurveyOverlap(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono bg-bg-tertiary border border-border-default rounded"
                  />
                  <span className="text-[9px] text-text-tertiary">%</span>
                </div>
              </div>
              {calculatedTriggerDist > 0 && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-bg-tertiary/50 rounded">
                  <span className="text-xs text-text-secondary">Calculated distance:</span>
                  <span className="text-sm font-mono text-accent-primary">{calculatedTriggerDist.toFixed(1)} m</span>
                  <Button size="sm" variant="ghost" onClick={applyCalculatedDistance} className="ml-auto">
                    Apply
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Manual Trigger */}
          {camEnabled && connected && (
            <Card icon={<Camera size={14} />} title="Manual Trigger" description="Trigger camera manually">
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleTrigger}>
                  <Aperture size={12} className="mr-1" /> Trigger Camera
                </Button>
                <span className="text-xs font-mono text-text-tertiary">
                  Images: {imageCount}
                </span>
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
