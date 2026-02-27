"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { PanelHeader } from "./PanelHeader";
import { Save, Radio, HardDrive } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const RC_CHANNEL_COUNT = 16;

const CHANNEL_OPTIONS = Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => ({
  value: String(i + 1),
  label: `Channel ${i + 1}`,
}));

// Build param name list: 4 mapping + 16 channels * 4 props = 68 params
const RECEIVER_PARAMS: string[] = [
  "RCMAP_ROLL", "RCMAP_PITCH", "RCMAP_THROTTLE", "RCMAP_YAW",
  ...Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => {
    const n = i + 1;
    return [`RC${n}_MIN`, `RC${n}_MAX`, `RC${n}_TRIM`, `RC${n}_REVERSED`];
  }).flat(),
];

// ── RC Channel Bar ───────────────────────────────────────────

function RcChannelBar({ index, value, min, max }: {
  index: number;
  value: number;
  min: number;
  max: number;
}) {
  const range = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-text-secondary w-6 text-right shrink-0">
        CH{index + 1}
      </span>
      <div className="flex-1 h-4 bg-bg-tertiary border border-border-default relative overflow-hidden">
        <div
          className="h-full bg-status-success/60 transition-all duration-75"
          style={{ width: `${pct}%` }}
        />
        {/* Center mark at 1500 */}
        <div
          className="absolute top-0 bottom-0 w-px bg-text-tertiary/30"
          style={{ left: `${((1500 - min) / range) * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-primary tabular-nums w-10 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function ReceiverPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Live RC data from telemetry store
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();
  const channels = latestRc?.channels ?? Array.from({ length: RC_CHANNEL_COUNT }, () => 0);
  const rssi = latestRc?.rssi ?? 0;

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: RECEIVER_PARAMS, panelId: "receiver", autoLoad: true });

  // ── Calibration state ──────────────────────────────────────
  const [calibrating, setCalibrating] = useState(false);
  const [calMins, setCalMins] = useState<number[]>(() => Array(RC_CHANNEL_COUNT).fill(2000));
  const [calMaxs, setCalMaxs] = useState<number[]>(() => Array(RC_CHANNEL_COUNT).fill(1000));

  // Update calibration extremes from live channel data
  useEffect(() => {
    if (!calibrating) return;
    setCalMins((prev) =>
      prev.map((v, i) => (channels[i] > 0 ? Math.min(v, channels[i]) : v)),
    );
    setCalMaxs((prev) =>
      prev.map((v, i) => (channels[i] > 0 ? Math.max(v, channels[i]) : v)),
    );
  }, [calibrating, channels]);

  // ── Helpers to read/write params from flat Map ──────────────

  const getMapping = (role: string) => String(params.get(`RCMAP_${role}`) ?? { ROLL: 1, PITCH: 2, THROTTLE: 3, YAW: 4 }[role] ?? 1);
  const getChannelMin = (i: number) => params.get(`RC${i + 1}_MIN`) ?? 1000;
  const getChannelMax = (i: number) => params.get(`RC${i + 1}_MAX`) ?? 2000;
  const getChannelTrim = (i: number) => params.get(`RC${i + 1}_TRIM`) ?? 1500;
  const getChannelReversed = (i: number) => (params.get(`RC${i + 1}_REVERSED`) ?? 0) !== 0;

  // ── Save / Flash ───────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Receiver parameters saved to RAM", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Parameters written to flash", "success");
    else toast("Failed to write to flash", "error");
  }

  // ── RC data guard ─────────────────────────────────────────
  const hasRcData = latestRc != null && channels.some((c) => c > 0);

  // ── Save calibration ──────────────────────────────────────

  const saveCalibration = useCallback(() => {
    for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
      if (calMins[i] < 1500) setLocalValue(`RC${i + 1}_MIN`, calMins[i]);
      if (calMaxs[i] > 1500) setLocalValue(`RC${i + 1}_MAX`, calMaxs[i]);
      // Set trim to current channel value (sticks centered at this point)
      if (channels[i] > 0) setLocalValue(`RC${i + 1}_TRIM`, channels[i]);
    }
    setCalibrating(false);
    toast("Calibration applied — save to write to FC", "info");
  }, [calMins, calMaxs, channels, setLocalValue, toast]);

  // ── RSSI percentage ────────────────────────────────────────

  const rssiPct = useMemo(() => Math.round((rssi / 255) * 100), [rssi]);

  const hasDirty = dirtyParams.size > 0;

  if (!protocol) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">RC Receiver</h2>
          <Card>
            <p className="text-xs text-text-tertiary">Connect to a drone to configure receiver.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-4">
        <PanelHeader
          title="RC Receiver"
          subtitle="Channel mapping, calibration, and per-channel settings"
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={!!protocol}
          error={error}
        >
          {hasDirty && (
            <span className="text-[10px] font-mono text-status-warning px-1.5 py-0.5 bg-status-warning/10 border border-status-warning/20">
              UNSAVED
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={12} />}
            loading={saving}
            disabled={!hasDirty}
            onClick={handleSave}
          >
            Save
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
        </PanelHeader>

        {/* ── Live RC Channels ──────────────────────────────── */}

        <Card title="Live RC Channels">
          <div className="space-y-1.5">
            {channels.slice(0, RC_CHANNEL_COUNT).map((val, i) => (
              <RcChannelBar
                key={i}
                index={i}
                value={val}
                min={getChannelMin(i)}
                max={getChannelMax(i)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-default">
            <Radio size={12} className="text-text-tertiary" />
            <span className="text-[10px] text-text-secondary">RSSI:</span>
            <span className="text-[10px] font-mono text-text-primary">{rssi}</span>
            <span className="text-[10px] text-text-tertiary">({rssiPct}%)</span>
          </div>
        </Card>

        {/* ── Channel Mapping ──────────────────────────────── */}

        <Card title="Channel Mapping">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Roll"
              value={getMapping("ROLL")}
              onChange={(v) => setLocalValue("RCMAP_ROLL", Number(v))}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Pitch"
              value={getMapping("PITCH")}
              onChange={(v) => setLocalValue("RCMAP_PITCH", Number(v))}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Throttle"
              value={getMapping("THROTTLE")}
              onChange={(v) => setLocalValue("RCMAP_THROTTLE", Number(v))}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Yaw"
              value={getMapping("YAW")}
              onChange={(v) => setLocalValue("RCMAP_YAW", Number(v))}
              options={CHANNEL_OPTIONS}
            />
          </div>
        </Card>

        {/* ── Per-Channel Settings ─────────────────────────── */}

        <Card title="Channel Settings" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default text-text-secondary">
                  <th className="px-3 py-2 text-left font-medium">CH</th>
                  <th className="px-3 py-2 text-left font-medium">Min</th>
                  <th className="px-3 py-2 text-left font-medium">Max</th>
                  <th className="px-3 py-2 text-left font-medium">Trim</th>
                  <th className="px-3 py-2 text-left font-medium">Rev</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => (
                  <tr key={i} className="border-b border-border-default last:border-0 hover:bg-bg-tertiary/50">
                    <td className="px-3 py-1.5 font-mono text-text-secondary">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={getChannelMin(i)}
                        onChange={(e) => setLocalValue(`RC${i + 1}_MIN`, Number(e.target.value))}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={getChannelMax(i)}
                        onChange={(e) => setLocalValue(`RC${i + 1}_MAX`, Number(e.target.value))}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={getChannelTrim(i)}
                        onChange={(e) => setLocalValue(`RC${i + 1}_TRIM`, Number(e.target.value))}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Toggle
                        label=""
                        checked={getChannelReversed(i)}
                        onChange={(v) => setLocalValue(`RC${i + 1}_REVERSED`, v ? 1 : 0)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Radio Calibration ────────────────────────────── */}

        <Card title="Radio Calibration">
          <div className="space-y-3">
            {!calibrating ? (
              <>
                <p className="text-[10px] text-text-tertiary">
                  Move all sticks and switches to their extreme positions, then save calibration to record min/max values.
                </p>
                {!hasRcData && (
                  <p className="text-[10px] text-status-warning">
                    No RC data received — ensure transmitter is on and bound.
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!hasRcData}
                  onClick={() => {
                    setCalMins(Array(RC_CHANNEL_COUNT).fill(2000));
                    setCalMaxs(Array(RC_CHANNEL_COUNT).fill(1000));
                    setCalibrating(true);
                  }}
                >
                  Start Calibration
                </Button>
              </>
            ) : (
              <>
                <div className="p-2 bg-status-warning/10 border border-status-warning/20">
                  <p className="text-[10px] text-status-warning font-medium">
                    Calibrating — Move all sticks and switches to their extreme positions now.
                  </p>
                </div>

                <div className="space-y-1">
                  {channels.slice(0, RC_CHANNEL_COUNT).map((val, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-text-secondary w-6 text-right">CH{i + 1}</span>
                      <span className="text-text-tertiary w-10 text-right">{calMins[i]}</span>
                      <div className="flex-1 h-3 bg-bg-tertiary border border-border-default relative overflow-hidden">
                        <div
                          className="h-full bg-accent-primary/40 transition-all duration-75"
                          style={{
                            left: `${((calMins[i] - 800) / 1200) * 100}%`,
                            width: `${((calMaxs[i] - calMins[i]) / 1200) * 100}%`,
                            position: "absolute",
                          }}
                        />
                      </div>
                      <span className="text-text-tertiary w-10">{calMaxs[i]}</span>
                      <span className="text-text-primary w-10 text-right">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save size={12} />}
                    onClick={saveCalibration}
                  >
                    Save Calibration
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalibrating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
