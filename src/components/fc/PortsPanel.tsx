"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import {
  Save,
  Usb,
  HardDrive,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";

// ── Constants ────────────────────────────────────────────────

/** Serial port protocol options (SERIAL_PROTOCOL values). */
const PROTOCOL_OPTIONS = [
  { value: "-1", label: "None" },
  { value: "1", label: "MAVLink1" },
  { value: "2", label: "MAVLink2" },
  { value: "4", label: "FrSky D" },
  { value: "5", label: "GPS" },
  { value: "7", label: "Alexmos Gimbal" },
  { value: "10", label: "FrSky PassThrough" },
  { value: "12", label: "CompassLearn" },
  { value: "13", label: "SToRM32 Gimbal" },
  { value: "14", label: "Rangefinder" },
  { value: "19", label: "ESC Telemetry" },
  { value: "20", label: "RunCam" },
  { value: "21", label: "CRSF (Crossfire)" },
  { value: "23", label: "RC Input" },
  { value: "28", label: "DDS / ROS2" },
];

/** Baud rate options (SERIAL_BAUD values). */
const BAUD_OPTIONS = [
  { value: "1", label: "1200" },
  { value: "2", label: "2400" },
  { value: "4", label: "4800" },
  { value: "9", label: "9600" },
  { value: "19", label: "19200" },
  { value: "38", label: "38400" },
  { value: "57", label: "57600" },
  { value: "111", label: "111100" },
  { value: "115", label: "115200" },
  { value: "230", label: "230400" },
  { value: "460", label: "460800" },
  { value: "500", label: "500000" },
  { value: "921", label: "921600" },
  { value: "1500", label: "1500000" },
];

const NUM_PORTS = 8;

/** Standard hardware labels for serial ports. */
const HARDWARE_LABELS: string[] = [
  "USB", "Telem1", "Telem2", "GPS1", "GPS2", "USER", "USER", "USER",
];

/** Module-level const to avoid re-render loops in usePanelParams. */
const PORT_PARAMS: string[] = Array.from({ length: NUM_PORTS }, (_, i) => [
  `SERIAL${i}_PROTOCOL`,
  `SERIAL${i}_BAUD`,
]).flat();

// ── PX4 Constants ────────────────────────────────────────────

const PX4_PORTS = [
  { label: "TELEM1", baudParam: "SER_TEL1_BAUD" },
  { label: "TELEM2", baudParam: "SER_TEL2_BAUD" },
  { label: "TELEM3", baudParam: "SER_TEL3_BAUD" },
  { label: "GPS1", baudParam: "SER_GPS1_BAUD" },
];

const PX4_PORT_PARAMS: string[] = PX4_PORTS.map((p) => p.baudParam);

const PX4_BAUD_OPTIONS = [
  { value: "0", label: "Auto" },
  { value: "9600", label: "9600" },
  { value: "19200", label: "19200" },
  { value: "38400", label: "38400" },
  { value: "57600", label: "57600" },
  { value: "115200", label: "115200" },
  { value: "230400", label: "230400" },
  { value: "460800", label: "460800" },
  { value: "921600", label: "921600" },
];

// ── Main Component ───────────────────────────────────────────

export function PortsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();
  const { toast } = useToast();
  const { firmwareType } = useFirmwareCapabilities();
  const isPx4 = firmwareType === "px4";
  const [saving, setSaving] = useState(false);
  const [needsReboot, setNeedsReboot] = useState(false);

  const portParamNames = useMemo(
    () => (isPx4 ? PX4_PORT_PARAMS : PORT_PARAMS),
    [isPx4],
  );

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash, revertAll,
  } = usePanelParams({ paramNames: portParamNames, panelId: "ports" });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!protocol;
  const hasDirty = dirtyParams.size > 0;

  // ── Helpers to read param values from flat Map ──────────────

  const getProtocolValue = (i: number) =>
    String(params.get(`SERIAL${i}_PROTOCOL`) ?? -1);

  const getBaudValue = (i: number) =>
    String(params.get(`SERIAL${i}_BAUD`) ?? 57);

  // ── Save / Flash / Reboot ───────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) {
      setNeedsReboot(true);
      toast("Saved to flight controller", "success");
    } else {
      toast("Some parameters failed to save", "warning");
    }
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Written to flash — persists after reboot", "success");
    else toast("Failed to write to flash", "error");
  }

  async function handleReboot() {
    if (!protocol) return;
    await protocol.reboot();
    setNeedsReboot(false);
  }

  // ── Render ──────────────────────────────────────────────────

  if (!protocol) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Serial Ports</h2>
          <Card>
            <p className="text-xs text-text-tertiary">Connect to a drone to configure serial ports.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <ArmedLockOverlay>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border-default bg-bg-secondary px-4 py-3 space-y-3">
          <PanelHeader
            title="Serial Ports"
            subtitle="Protocol and baud rate for each serial port"
            icon={<Usb size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          >
            {hasDirty && (
              <span className="text-[10px] font-mono text-status-warning px-1.5 py-0.5 bg-status-warning/10 border border-status-warning/20">
                UNSAVED
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={revertAll}
              disabled={!hasDirty}
            >
              Revert
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={12} />}
              onClick={handleSave}
              disabled={!hasDirty}
              loading={saving}
            >
              Save Changes
            </Button>
            {hasRamWrites && (
              <Button
                variant="secondary"
                size="sm"
                icon={<HardDrive size={12} />}
                onClick={handleFlash}
              >
                Write to Flash
              </Button>
            )}
            {needsReboot && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleReboot}
              >
                Reboot FC
              </Button>
            )}
          </PanelHeader>
        </div>

        {/* Reboot info banner */}
        {needsReboot && (
          <div className="flex-shrink-0 px-4 py-2 bg-status-warning/10 border-b border-status-warning/30 flex items-center gap-2">
            <Info size={14} className="text-status-warning flex-shrink-0" />
            <span className="text-xs text-status-warning">
              Serial port changes require a reboot to take effect.
            </span>
          </div>
        )}

        {/* Port table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl space-y-2">
            {!hasLoaded && !loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-xs text-text-tertiary">
                  Click "Read from FC" to load serial parameters.
                </span>
              </div>
            ) : loading && !hasLoaded ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-xs text-text-tertiary">Loading serial parameters...</span>
              </div>
            ) : isPx4 ? (
              <div className="space-y-3">
                <p className="text-xs text-text-tertiary">
                  PX4 auto-detects port protocols. Configure baud rates below.
                </p>
                {PX4_PORTS.map((port) => (
                  <div key={port.baudParam} className="flex items-center gap-4 p-3 rounded-md bg-bg-tertiary">
                    <span className="text-xs font-medium text-text-primary w-20">{port.label}</span>
                    <Select
                      value={String(params.get(port.baudParam) ?? "0")}
                      onChange={(v) => setLocalValue(port.baudParam, Number(v))}
                      options={PX4_BAUD_OPTIONS}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[60px_80px_1fr_1fr] gap-3 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Port
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Label
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Protocol
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Baud Rate
                  </span>
                </div>

                {Array.from({ length: NUM_PORTS }, (_, i) => {
                  const protocolDirty = dirtyParams.has(`SERIAL${i}_PROTOCOL`);
                  const baudDirty = dirtyParams.has(`SERIAL${i}_BAUD`);
                  const rowChanged = protocolDirty || baudDirty;

                  return (
                    <Card key={i} className={rowChanged ? "border-status-warning/40" : undefined}>
                      <div className="grid grid-cols-[60px_80px_1fr_1fr] gap-3 items-center">
                        <span className="text-xs font-mono text-text-secondary">
                          SERIAL{i}
                        </span>
                        <span className="text-xs text-text-tertiary">
                          {HARDWARE_LABELS[i]}
                        </span>
                        <Select
                          options={PROTOCOL_OPTIONS}
                          value={getProtocolValue(i)}
                          onChange={(v) => setLocalValue(`SERIAL${i}_PROTOCOL`, Number(v))}
                          className={protocolDirty ? "border-status-warning/60" : undefined}
                        />
                        <Select
                          options={BAUD_OPTIONS}
                          value={getBaudValue(i)}
                          onChange={(v) => setLocalValue(`SERIAL${i}_BAUD`, Number(v))}
                          className={baudDirty ? "border-status-warning/60" : undefined}
                        />
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </ArmedLockOverlay>
  );
}
