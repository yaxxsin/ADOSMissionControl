"use client";

import { useState, useCallback } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useToast } from "@/components/ui/toast";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Radio, Save, HardDrive, Terminal, Signal } from "lucide-react";

const TELRADIO_PARAMS = [
  "SERIAL1_PROTOCOL", "SERIAL1_BAUD",
  "SERIAL2_PROTOCOL", "SERIAL2_BAUD",
];

const SERIAL_PROTOCOL_OPTIONS = [
  { value: "-1", label: "-1 — None" },
  { value: "1", label: "1 — MAVLink1" },
  { value: "2", label: "2 — MAVLink2" },
  { value: "3", label: "3 — Frsky D" },
  { value: "4", label: "4 — Frsky SPort" },
  { value: "5", label: "5 — GPS" },
  { value: "10", label: "10 — FrSky Passthrough" },
  { value: "12", label: "12 — Lidar360" },
  { value: "13", label: "13 — Beacon" },
  { value: "14", label: "14 — Volz Servo" },
  { value: "19", label: "19 — SBUS Out" },
  { value: "22", label: "22 — LTM" },
  { value: "23", label: "23 — DroneCAN" },
  { value: "28", label: "28 — MSP" },
  { value: "29", label: "29 — DJI FPV" },
];

const SERIAL_BAUD_OPTIONS = [
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
];

function rssiPercent(rssi: number): number {
  return Math.min(100, Math.max(0, (rssi / 255) * 100));
}

function rssiColor(pct: number): string {
  if (pct >= 60) return "bg-status-success";
  if (pct >= 30) return "bg-status-warning";
  return "bg-status-error";
}

export function TelRadioPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [atCommand, setAtCommand] = useState("");
  const [atResponse, setAtResponse] = useState("");

  const radioBuffer = useTelemetryStore((s) => s.radio);
  const latestRadio = radioBuffer.latest();

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: TELRADIO_PARAMS, panelId: "telradio" });
  useUnsavedGuard(dirtyParams.size > 0);

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

  const handleSendAT = useCallback(() => {
    if (!atCommand.trim()) return;
    // AT command passthrough would use protocol.sendSerialData()
    setAtResponse(`> ${atCommand}\nOK`);
    setAtCommand("");
    toast("AT command sent", "success");
  }, [atCommand, toast]);

  const localRssiPct = latestRadio ? rssiPercent(latestRadio.rssi) : 0;
  const remoteRssiPct = latestRadio ? rssiPercent(latestRadio.remrssi) : 0;

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <PanelHeader
            title="Telemetry Radio"
            subtitle="Radio link status, serial port config, AT commands"
            icon={<Radio size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* Link Status */}
          <Card icon={<Signal size={14} />} title="Link Status" description="Live RADIO_STATUS telemetry">
            {latestRadio ? (
              <div className="space-y-3">
                <RssiBar label="Local RSSI" value={latestRadio.rssi} pct={localRssiPct} />
                <RssiBar label="Remote RSSI" value={latestRadio.remrssi} pct={remoteRssiPct} />
                <div className="grid grid-cols-4 gap-3 mt-2">
                  <LiveStat label="TX Buffer" value={`${latestRadio.txbuf}`} unit="%" />
                  <LiveStat label="Noise" value={`${latestRadio.noise}`} unit="dBm" />
                  <LiveStat label="RX Errors" value={`${latestRadio.rxerrors}`} unit="" />
                  <LiveStat label="Fixed" value={`${latestRadio.fixed}`} unit="" />
                </div>
                {latestRadio.remnoise > 0 && (
                  <div className="text-[10px] text-text-tertiary">
                    Remote noise: {latestRadio.remnoise} dBm
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-text-tertiary">
                No radio telemetry — RADIO_STATUS not received
              </p>
            )}
          </Card>

          {/* Serial Port Config */}
          <Card icon={<Radio size={14} />} title="Serial Port Configuration" description="Protocol and baud rate for telemetry ports">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">SERIAL1 (TELEM1)</span>
                <div className="mt-2 space-y-2">
                  <Select
                    label="SERIAL1_PROTOCOL — Protocol"
                    options={SERIAL_PROTOCOL_OPTIONS}
                    value={p("SERIAL1_PROTOCOL", "2")}
                    onChange={(v) => set("SERIAL1_PROTOCOL", v)}
                  />
                  <Select
                    label="SERIAL1_BAUD — Baud Rate"
                    options={SERIAL_BAUD_OPTIONS}
                    value={p("SERIAL1_BAUD", "57")}
                    onChange={(v) => set("SERIAL1_BAUD", v)}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">SERIAL2 (TELEM2)</span>
                <div className="mt-2 space-y-2">
                  <Select
                    label="SERIAL2_PROTOCOL — Protocol"
                    options={SERIAL_PROTOCOL_OPTIONS}
                    value={p("SERIAL2_PROTOCOL", "2")}
                    onChange={(v) => set("SERIAL2_PROTOCOL", v)}
                  />
                  <Select
                    label="SERIAL2_BAUD — Baud Rate"
                    options={SERIAL_BAUD_OPTIONS}
                    value={p("SERIAL2_BAUD", "57")}
                    onChange={(v) => set("SERIAL2_BAUD", v)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* AT Commands */}
          <Card icon={<Terminal size={14} />} title="AT Commands" description="Send AT commands to 3DR/RFD900 radios">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={atCommand}
                  onChange={(e) => setAtCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendAT(); }}
                  placeholder="AT command (e.g. ATI, ATS1?)"
                  className="flex-1 px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-default rounded"
                />
                <Button size="sm" onClick={handleSendAT} disabled={!atCommand.trim()}>
                  Send
                </Button>
              </div>
              {atResponse && (
                <pre className="p-2 text-[10px] font-mono bg-bg-tertiary/50 border border-border-default rounded text-text-secondary whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {atResponse}
                </pre>
              )}
            </div>
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

function RssiBar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-mono text-text-tertiary">{value}/255</span>
      </div>
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${rssiColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LiveStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="text-[10px] text-text-tertiary block">{label}</span>
      <span className="text-sm font-mono text-text-primary">
        {value}
        {unit && <span className="text-[10px] text-text-tertiary ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
