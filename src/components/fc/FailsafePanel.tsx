"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useParamLabel } from "@/hooks/use-param-label";
import { useParamMetadataMap } from "@/hooks/use-param-metadata";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ParamLabel } from "./ParamLabel";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { ShieldAlert, Battery, Radio, Gauge, Save, HardDrive, MapPin, SlidersHorizontal, Mountain } from "lucide-react";
import { StarredParam } from "./ParamStar";

const RC_CHANNEL_COUNT = 8;

const RC_OPTION_VALUES = [
  { value: "0", label: "0 — Do Nothing", description: "No action assigned to this channel" },
  { value: "2", label: "2 — Flip", description: "Trigger a flip maneuver" },
  { value: "3", label: "3 — Simple Mode", description: "Earth-frame heading control" },
  { value: "4", label: "4 — RTL", description: "Return to launch point and land" },
  { value: "7", label: "7 — Save WP", description: "Save current position as waypoint" },
  { value: "9", label: "9 — Camera Trigger", description: "Trigger camera shutter" },
  { value: "10", label: "10 — RangeFinder", description: "Enable/disable rangefinder" },
  { value: "11", label: "11 — Fence", description: "Enable/disable geofence" },
  { value: "16", label: "16 — Auto", description: "Switch to auto mission mode" },
  { value: "17", label: "17 — AutoTune", description: "Start automatic PID tuning" },
  { value: "18", label: "18 — Land", description: "Land at current position" },
  { value: "21", label: "21 — Parachute Enable", description: "Arm the parachute release mechanism" },
  { value: "22", label: "22 — Parachute Release", description: "Deploy parachute immediately" },
  { value: "28", label: "28 — Relay1 On/Off", description: "Toggle relay output 1" },
  { value: "39", label: "39 — Motor Emergency Stop", description: "Kill all motors immediately" },
  { value: "40", label: "40 — Motor Interlock", description: "Motors only spin when switch is active" },
  { value: "41", label: "41 — Brake", description: "Rapid stop and hold position" },
  { value: "55", label: "55 — Guided", description: "Switch to GCS-guided flight" },
  { value: "56", label: "56 — Loiter", description: "Hold GPS position and altitude" },
  { value: "57", label: "57 — Follow", description: "Follow another vehicle or GCS" },
];

/** ArduCopter FS_OPTIONS bitmask bits */
const FS_OPTION_BITS = [
  { mask: 1 << 0, label: "Bit 0 — Continue if in auto mode on RC failsafe" },
  { mask: 1 << 1, label: "Bit 1 — Continue if in auto mode on GCS failsafe" },
  { mask: 1 << 2, label: "Bit 2 — Continue if in guided mode on RC failsafe" },
  { mask: 1 << 3, label: "Bit 3 — Continue if landing on any failsafe" },
  { mask: 1 << 4, label: "Bit 4 — Continue if in pilot controlled mode on GCS failsafe" },
  { mask: 1 << 5, label: "Bit 5 — Release gripper" },
];

// Vehicle-specific failsafe params
const COPTER_FS_PARAMS = [
  "FS_SHORT_ACTN", "FS_SHORT_TIMEOUT", "FS_LONG_ACTN", "FS_LONG_TIMEOUT", "FS_GCS_ENABL",
  "TERRAIN_ENABLE", "FS_OPTIONS", "FS_THR_VALUE",
];
const PLANE_FS_PARAMS = [
  "THR_FAILSAFE", "THR_FS_VALUE",
];
const SHARED_FS_PARAMS = [
  "BATT_FS_VOLTSRC", "BATT_FS_LOW_VOLT", "BATT_FS_LOW_ACT",
  "FENCE_ENABLE", "FENCE_ACTION", "FENCE_ALT_MAX", "FENCE_RADIUS", "FENCE_ALT_MIN",
  ...Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => `RC${i + 1}_OPTION`),
];

export function FailsafePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();
  const { label: pl } = useParamLabel();
  const metadata = useParamMetadataMap();
  const lbl = (raw: string) => <ParamLabel label={pl(raw)} metadata={metadata} />;
  const scrollRef = usePanelScroll("failsafe");
  const [saving, setSaving] = useState(false);

  // Detect vehicle type for vehicle-specific param loading
  const drone = getSelectedDrone();
  const isPlane = useMemo(() => {
    const vc = drone?.vehicleInfo?.vehicleClass;
    return vc === "plane" || vc === "vtol";
  }, [drone?.vehicleInfo?.vehicleClass]);

  const paramNames = useMemo(
    () => [...SHARED_FS_PARAMS, ...(isPlane ? PLANE_FS_PARAMS : COPTER_FS_PARAMS)],
    [isPlane],
  );
  const optionalParams = useMemo(
    () => isPlane ? COPTER_FS_PARAMS : PLANE_FS_PARAMS,
    [isPlane],
  );

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded, missingOptional,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames, optionalParams, panelId: "failsafe", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  /** Get param as string for Select/Input display */
  const p = (name: string, fallback = "0") => String(params.get(name) ?? fallback);
  /** Set param from string input */
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

  return (
    <ArmedLockOverlay>
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <PanelHeader
          title="Failsafe Configuration"
          subtitle="Configure failsafe actions for loss of control, battery, and GCS link"
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={connected}
          error={error}
          missingOptional={missingOptional}
        />

        {/* Short Failsafe (Copter only) */}
        {!isPlane && <Card icon={<ShieldAlert size={14} />} title="Short Failsafe" description="Triggered on brief signal loss">
          <StarredParam param="FS_SHORT_ACTN">
            <Select
              label={lbl("FS_SHORT_ACTN — Action")}
              options={[
                { value: "0", label: "0 — Disabled" },
                { value: "1", label: "1 — Enabled (Circle)" },
              ]}
              value={p("FS_SHORT_ACTN")}
              onChange={(v) => set("FS_SHORT_ACTN", v)}
            />
          </StarredParam>
          <StarredParam param="FS_SHORT_TIMEOUT">
            <Input
              label={lbl("FS_SHORT_TIMEOUT — Timeout (s)")}
              type="number"
              step="0.1"
              min="0"
              unit="s"
              value={p("FS_SHORT_TIMEOUT", "1.5")}
              onChange={(e) => set("FS_SHORT_TIMEOUT", e.target.value)}
            />
          </StarredParam>
        </Card>}

        {/* Long Failsafe (Copter only) */}
        {!isPlane && <Card icon={<ShieldAlert size={14} />} title="Long Failsafe" description="Triggered on extended signal loss">
          <StarredParam param="FS_LONG_ACTN">
            <Select
              label={lbl("FS_LONG_ACTN — Action")}
              options={[
                { value: "0", label: "0 — Continue" },
                { value: "1", label: "1 — RTL" },
                { value: "2", label: "2 — Glide" },
              ]}
              value={p("FS_LONG_ACTN")}
              onChange={(v) => set("FS_LONG_ACTN", v)}
            />
          </StarredParam>
          <StarredParam param="FS_LONG_TIMEOUT">
            <Input
              label={lbl("FS_LONG_TIMEOUT — Timeout (s)")}
              type="number"
              step="0.1"
              min="0"
              unit="s"
              value={p("FS_LONG_TIMEOUT", "5.0")}
              onChange={(e) => set("FS_LONG_TIMEOUT", e.target.value)}
            />
          </StarredParam>
        </Card>}

        {/* Battery Failsafe */}
        <Card icon={<Battery size={14} />} title="Battery Failsafe" description="Triggered on low battery voltage">
          <StarredParam param="BATT_FS_VOLTSRC">
            <Select
              label={lbl("BATT_FS_VOLTSRC — Voltage Source")}
              options={[
                { value: "0", label: "0 — Raw Voltage" },
                { value: "1", label: "1 — Sag Compensated" },
              ]}
              value={p("BATT_FS_VOLTSRC")}
              onChange={(v) => set("BATT_FS_VOLTSRC", v)}
            />
          </StarredParam>
          <StarredParam param="BATT_FS_LOW_VOLT">
            <Input
              label={lbl("BATT_FS_LOW_VOLT — Low Voltage Threshold")}
              type="number"
              step="0.1"
              min="0"
              unit="V"
              value={p("BATT_FS_LOW_VOLT")}
              onChange={(e) => set("BATT_FS_LOW_VOLT", e.target.value)}
            />
          </StarredParam>
          <StarredParam param="BATT_FS_LOW_ACT">
            <Select
              label={lbl("BATT_FS_LOW_ACT — Low Voltage Action")}
              options={[
                { value: "0", label: "0 — None" },
                { value: "1", label: "1 — Land" },
                { value: "2", label: "2 — RTL" },
                { value: "3", label: "3 — SmartRTL or RTL" },
              ]}
              value={p("BATT_FS_LOW_ACT")}
              onChange={(v) => set("BATT_FS_LOW_ACT", v)}
            />
          </StarredParam>
        </Card>

        {/* GCS Failsafe (Copter only) */}
        {!isPlane && <Card icon={<Radio size={14} />} title="GCS Failsafe" description="Triggered on GCS link loss">
          <StarredParam param="FS_GCS_ENABL">
            <Select
              label={lbl("FS_GCS_ENABL — GCS Failsafe")}
              options={[
                { value: "0", label: "0 — Disabled" },
                { value: "1", label: "1 — Enabled (RTL)" },
                { value: "2", label: "2 — Enabled (continue in auto)" },
              ]}
              value={p("FS_GCS_ENABL")}
              onChange={(v) => set("FS_GCS_ENABL", v)}
            />
          </StarredParam>
        </Card>}

        {/* Terrain Failsafe (Copter only) */}
        {!isPlane && <Card icon={<Mountain size={14} />} title="Terrain Failsafe" description="Triggered when terrain data is unavailable during terrain-following">
          <Select
            label={lbl("TERRAIN_ENABLE — Terrain Following")}
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Enabled" },
            ]}
            value={p("TERRAIN_ENABLE")}
            onChange={(v) => set("TERRAIN_ENABLE", v)}
          />
        </Card>}

        {/* Failsafe Options Bitmask (Copter only) */}
        {!isPlane && <Card icon={<ShieldAlert size={14} />} title="Failsafe Options" description="FS_OPTIONS bitmask — additional failsafe behaviors">
          <div className="space-y-1.5">
            {FS_OPTION_BITS.map((bit) => {
              const current = Number(params.get("FS_OPTIONS") ?? 0);
              const isSet = (current & bit.mask) !== 0;
              return (
                <label key={bit.mask} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSet}
                    onChange={() => set("FS_OPTIONS", String(current ^ bit.mask))}
                    className="accent-accent-primary"
                  />
                  <span className="text-xs text-text-secondary">{bit.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] font-mono text-text-tertiary mt-2">
            FS_OPTIONS = {Number(params.get("FS_OPTIONS") ?? 0)} (0x{(Number(params.get("FS_OPTIONS") ?? 0)).toString(16).padStart(4, "0")})
          </p>
        </Card>}

        {/* Throttle Failsafe PWM (Copter) */}
        {!isPlane && <Card icon={<Gauge size={14} />} title="Throttle Failsafe PWM" description="PWM value below which throttle failsafe triggers">
          <StarredParam param="FS_THR_VALUE">
            <Input
              label={lbl("FS_THR_VALUE — Throttle PWM Threshold")}
              type="number"
              step="1"
              min="800"
              max="1200"
              unit="μs"
              value={p("FS_THR_VALUE", "975")}
              onChange={(e) => set("FS_THR_VALUE", e.target.value)}
            />
          </StarredParam>
          <p className="text-[10px] text-text-tertiary">
            When throttle PWM drops below this value, the short failsafe action triggers.
            Set this ~10μs below your RC transmitter&apos;s minimum throttle output.
          </p>
        </Card>}

        {/* Throttle Failsafe (Plane only) */}
        {isPlane && <Card icon={<Gauge size={14} />} title="Throttle Failsafe" description="Triggered on RC throttle loss">
          <Select
            label={lbl("THR_FAILSAFE — Throttle Failsafe")}
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Enabled" },
            ]}
            value={p("THR_FAILSAFE")}
            onChange={(v) => set("THR_FAILSAFE", v)}
          />
          <Input
            label={lbl("THR_FS_VALUE — Throttle PWM value")}
            type="number"
            step="1"
            min="800"
            max="1200"
            unit="μs"
            value={p("THR_FS_VALUE", "950")}
            onChange={(e) => set("THR_FS_VALUE", e.target.value)}
          />
        </Card>}

        {/* Per-Channel RC Options */}
        <Card icon={<SlidersHorizontal size={14} />} title="RC Channel Options" description="Per-channel RC switch functions (RCn_OPTION)">
          <div className="space-y-2">
            {Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => {
              const ch = i + 1;
              const paramName = `RC${ch}_OPTION`;
              return (
                <div key={ch} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-secondary w-6 text-right">CH{ch}</span>
                  <Select
                    options={RC_OPTION_VALUES}
                    value={p(paramName)}
                    onChange={(v) => set(paramName, v)}
                    className="flex-1"
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Geofence */}
        <Card icon={<MapPin size={14} />} title="Geofence" description="Geographical boundary enforcement">
          <Select
            label={lbl("FENCE_ENABLE — Fence Type")}
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Altitude Only" },
              { value: "2", label: "2 — Circle Only" },
              { value: "3", label: "3 — Altitude + Circle" },
              { value: "4", label: "4 — Polygon Only" },
              { value: "5", label: "5 — Altitude + Polygon" },
              { value: "6", label: "6 — Circle + Polygon" },
              { value: "7", label: "7 — All" },
            ]}
            value={p("FENCE_ENABLE")}
            onChange={(v) => set("FENCE_ENABLE", v)}
          />
          <Select
            label={lbl("FENCE_ACTION — Breach Action")}
            options={[
              { value: "0", label: "0 — Report Only" },
              { value: "1", label: "1 — RTL or Land" },
              { value: "2", label: "2 — Always Land" },
              { value: "3", label: "3 — SmartRTL or RTL or Land" },
              { value: "4", label: "4 — Brake or Land" },
              { value: "5", label: "5 — SmartRTL or Land" },
            ]}
            value={p("FENCE_ACTION")}
            onChange={(v) => set("FENCE_ACTION", v)}
          />
          <Input label={lbl("FENCE_ALT_MAX — Max Altitude")} type="number" step="1" min="0" unit="m" value={p("FENCE_ALT_MAX", "100")} onChange={(e) => set("FENCE_ALT_MAX", e.target.value)} />
          <Input label={lbl("FENCE_RADIUS — Max Radius")} type="number" step="1" min="0" unit="m" value={p("FENCE_RADIUS", "300")} onChange={(e) => set("FENCE_RADIUS", e.target.value)} />
          <Input label={lbl("FENCE_ALT_MIN — Min Altitude")} type="number" step="0.5" min="-100" unit="m" value={p("FENCE_ALT_MIN")} onChange={(e) => set("FENCE_ALT_MIN", e.target.value)} />
        </Card>

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
