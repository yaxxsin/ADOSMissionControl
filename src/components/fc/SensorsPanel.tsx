"use client";

import { useState } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useToast } from "@/components/ui/toast";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Gauge, Save, HardDrive } from "lucide-react";

const SENSOR_PARAMS = [
  "RNGFND1_TYPE", "RNGFND1_PIN", "RNGFND1_MIN_CM", "RNGFND1_MAX_CM", "RNGFND1_ORIENT",
  "FLOW_TYPE", "FLOW_FXSCALER", "FLOW_FYSCALER", "FLOW_ORIENT_YAW",
  "ARSPD_TYPE", "ARSPD_USE", "ARSPD_OFFSET", "ARSPD_RATIO",
  "GND_ABS_PRESS", "GND_TEMP", "BARO_PRIMARY",
];

const RNGFND_TYPE_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — Analog" },
  { value: "2", label: "2 — MaxbotixI2C" },
  { value: "5", label: "5 — PX4" },
  { value: "9", label: "9 — LightWareI2C" },
  { value: "10", label: "10 — MAVLink" },
  { value: "16", label: "16 — Benewake TFmini" },
  { value: "17", label: "17 — LightWareSerial" },
  { value: "20", label: "20 — Benewake TF02" },
];

const RNGFND_ORIENT_OPTIONS = [
  { value: "0", label: "0 — Forward" },
  { value: "24", label: "24 — Up" },
  { value: "25", label: "25 — Down" },
];

const FLOW_TYPE_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — PX4Flow" },
  { value: "2", label: "2 — Pixart" },
  { value: "5", label: "5 — PMW3901" },
];

const ARSPD_TYPE_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — MS4525D" },
  { value: "2", label: "2 — Analog" },
  { value: "3", label: "3 — MS5525" },
  { value: "7", label: "7 — DLVR" },
  { value: "8", label: "8 — UAVCAN" },
];

export function SensorsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const vfrBuffer = useTelemetryStore((s) => s.vfr);
  const latestVfr = vfrBuffer.latest();

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: SENSOR_PARAMS, panelId: "sensors" });

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

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

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          <PanelHeader
            title="Sensors"
            subtitle="Rangefinder, optical flow, airspeed, barometer configuration"
            icon={<Gauge size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* Rangefinder */}
          <CollapsibleSection title="Rangefinder" defaultOpen>
            <div className="p-4 space-y-3">
              <Select
                label="RNGFND1_TYPE — Sensor Type"
                options={RNGFND_TYPE_OPTIONS}
                value={p("RNGFND1_TYPE")}
                onChange={(v) => set("RNGFND1_TYPE", v)}
              />
              {p("RNGFND1_TYPE") !== "0" && (
                <>
                  <Input
                    label="RNGFND1_PIN — Analog Pin"
                    type="number"
                    step="1"
                    min="-1"
                    value={p("RNGFND1_PIN", "-1")}
                    onChange={(e) => set("RNGFND1_PIN", e.target.value)}
                  />
                  <Input
                    label="RNGFND1_MIN_CM — Min Distance"
                    type="number"
                    step="1"
                    min="0"
                    unit="cm"
                    value={p("RNGFND1_MIN_CM", "20")}
                    onChange={(e) => set("RNGFND1_MIN_CM", e.target.value)}
                  />
                  <Input
                    label="RNGFND1_MAX_CM — Max Distance"
                    type="number"
                    step="1"
                    min="0"
                    unit="cm"
                    value={p("RNGFND1_MAX_CM", "700")}
                    onChange={(e) => set("RNGFND1_MAX_CM", e.target.value)}
                  />
                  <Select
                    label="RNGFND1_ORIENT — Orientation"
                    options={RNGFND_ORIENT_OPTIONS}
                    value={p("RNGFND1_ORIENT", "25")}
                    onChange={(v) => set("RNGFND1_ORIENT", v)}
                  />
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* Optical Flow */}
          <CollapsibleSection title="Optical Flow">
            <div className="p-4 space-y-3">
              <Select
                label="FLOW_TYPE — Sensor Type"
                options={FLOW_TYPE_OPTIONS}
                value={p("FLOW_TYPE")}
                onChange={(v) => set("FLOW_TYPE", v)}
              />
              {p("FLOW_TYPE") !== "0" && (
                <>
                  <Input
                    label="FLOW_FXSCALER — X Scaler"
                    type="number"
                    step="1"
                    value={p("FLOW_FXSCALER")}
                    onChange={(e) => set("FLOW_FXSCALER", e.target.value)}
                  />
                  <Input
                    label="FLOW_FYSCALER — Y Scaler"
                    type="number"
                    step="1"
                    value={p("FLOW_FYSCALER")}
                    onChange={(e) => set("FLOW_FYSCALER", e.target.value)}
                  />
                  <Input
                    label="FLOW_ORIENT_YAW — Yaw Orientation"
                    type="number"
                    step="1"
                    min="0"
                    max="7"
                    unit="cw45°"
                    value={p("FLOW_ORIENT_YAW")}
                    onChange={(e) => set("FLOW_ORIENT_YAW", e.target.value)}
                  />
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* Airspeed */}
          <CollapsibleSection title="Airspeed">
            <div className="p-4 space-y-3">
              <Select
                label="ARSPD_TYPE — Sensor Type"
                options={ARSPD_TYPE_OPTIONS}
                value={p("ARSPD_TYPE")}
                onChange={(v) => set("ARSPD_TYPE", v)}
              />
              {p("ARSPD_TYPE") !== "0" && (
                <>
                  <Select
                    label="ARSPD_USE — Use Airspeed"
                    options={[
                      { value: "0", label: "0 — Disabled" },
                      { value: "1", label: "1 — Enabled" },
                      { value: "2", label: "2 — Use only for EKF" },
                    ]}
                    value={p("ARSPD_USE", "1")}
                    onChange={(v) => set("ARSPD_USE", v)}
                  />
                  <Input
                    label="ARSPD_OFFSET — Pressure Offset"
                    type="number"
                    step="0.1"
                    unit="Pa"
                    value={p("ARSPD_OFFSET")}
                    onChange={(e) => set("ARSPD_OFFSET", e.target.value)}
                  />
                  <Input
                    label="ARSPD_RATIO — Speed Ratio"
                    type="number"
                    step="0.01"
                    value={p("ARSPD_RATIO", "1.9936")}
                    onChange={(e) => set("ARSPD_RATIO", e.target.value)}
                  />
                </>
              )}
              {latestVfr && (
                <div className="mt-2 p-2 bg-bg-tertiary/50 rounded">
                  <span className="text-[10px] text-text-tertiary">Live Airspeed</span>
                  <span className="text-sm font-mono text-text-primary ml-2">
                    {latestVfr.airspeed.toFixed(1)} <span className="text-[10px] text-text-tertiary">m/s</span>
                  </span>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Barometer */}
          <CollapsibleSection title="Barometer">
            <div className="p-4 space-y-3">
              <Input
                label="GND_ABS_PRESS — Absolute Pressure"
                type="number"
                step="0.01"
                unit="Pa"
                value={p("GND_ABS_PRESS")}
                onChange={(e) => set("GND_ABS_PRESS", e.target.value)}
              />
              <Input
                label="GND_TEMP — Ground Temperature"
                type="number"
                step="0.1"
                unit="°C"
                value={p("GND_TEMP")}
                onChange={(e) => set("GND_TEMP", e.target.value)}
              />
              <Select
                label="BARO_PRIMARY — Primary Barometer"
                options={[
                  { value: "0", label: "0 — First Baro" },
                  { value: "1", label: "1 — Second Baro" },
                  { value: "2", label: "2 — Third Baro" },
                ]}
                value={p("BARO_PRIMARY")}
                onChange={(v) => set("BARO_PRIMARY", v)}
              />
            </div>
          </CollapsibleSection>

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
