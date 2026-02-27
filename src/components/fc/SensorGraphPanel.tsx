"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { VibrationGauges } from "@/components/indicators/VibrationGauges";
import { EkfStatusBars } from "@/components/indicators/EkfStatusBars";
import { Activity, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScaledImuCallback } from "@/lib/protocol/types";

// ── Types ───────────────────────────────────────────────────

type SourceTab = "gyro" | "accel" | "mag" | "vibration" | "ekf";
type TimeWindow = 5 | 15 | 30 | 60;

interface ImuSample {
  timestamp: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xmag: number;
  ymag: number;
  zmag: number;
}

const TIME_WINDOWS: TimeWindow[] = [5, 15, 30, 60];
const MAX_SAMPLES = 1200; // enough for 60s at 20Hz

const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: "gyro", label: "Gyro" },
  { key: "accel", label: "Accel" },
  { key: "mag", label: "Mag" },
  { key: "vibration", label: "Vibration" },
  { key: "ekf", label: "EKF" },
];

const AXIS_COLORS = {
  x: "#3A82FF",   // blue
  y: "#22c55e",   // green
  z: "#f59e0b",   // amber
};

// ── Waveform chart (inline SVG) ─────────────────────────────

function WaveformChart({
  data,
  label,
  unit,
  color,
  height = 60,
}: {
  data: number[];
  label: string;
  unit: string;
  color: string;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-text-tertiary w-4">{label}</span>
        <div
          className="flex-1 bg-bg-tertiary/30 rounded flex items-center justify-center"
          style={{ height }}
        >
          <span className="text-[9px] text-text-tertiary">Waiting...</span>
        </div>
        <span className="text-[9px] font-mono text-text-tertiary w-16 text-right">— {unit}</span>
      </div>
    );
  }

  const width = 400;
  const pad = 2;
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - pad - ((v - minV) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const latest = data[data.length - 1];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-text-tertiary w-4">{label}</span>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="flex-1 bg-bg-tertiary/30 rounded"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Zero reference line */}
        {minV <= 0 && maxV >= 0 && (
          <line
            x1="0"
            y1={height - pad - ((0 - minV) / range) * (height - pad * 2)}
            x2={width}
            y2={height - pad - ((0 - minV) / range) * (height - pad * 2)}
            stroke="var(--border-default)"
            strokeWidth="0.5"
            strokeDasharray="4,4"
          />
        )}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Min/max labels */}
        <text x={2} y={10} fill="var(--text-tertiary)" fontSize="8" fontFamily="monospace">
          {maxV.toFixed(1)}
        </text>
        <text x={2} y={height - 2} fill="var(--text-tertiary)" fontSize="8" fontFamily="monospace">
          {minV.toFixed(1)}
        </text>
      </svg>
      <span className="text-[9px] font-mono text-text-tertiary w-16 text-right tabular-nums">
        {latest.toFixed(1)} {unit}
      </span>
    </div>
  );
}

// ── SensorGraphPanel ────────────────────────────────────────

export function SensorGraphPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);

  // Also read attitude ring buffer for gyro rate data as fallback
  const attitudeRing = useTelemetryStore((s) => s.attitude);

  const [source, setSource] = useState<SourceTab>("gyro");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(15);
  const [frozen, setFrozen] = useState(false);
  const [tick, setTick] = useState(0);

  // IMU sample buffer — collected from onScaledImu callback
  const samplesRef = useRef<ImuSample[]>([]);
  const frozenRef = useRef(false);
  frozenRef.current = frozen;

  // Subscribe to SCALED_IMU via protocol
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol?.onScaledImu) return;

    const unsub = protocol.onScaledImu((data) => {
      if (frozenRef.current) return;

      samplesRef.current.push({
        timestamp: data.timestamp,
        xgyro: data.xgyro,
        ygyro: data.ygyro,
        zgyro: data.zgyro,
        xacc: data.xacc,
        yacc: data.yacc,
        zacc: data.zacc,
        xmag: data.xmag,
        ymag: data.ymag,
        zmag: data.zmag,
      });

      if (samplesRef.current.length > MAX_SAMPLES) {
        samplesRef.current.splice(0, samplesRef.current.length - MAX_SAMPLES);
      }
    });

    return unsub;
  }, [getSelectedProtocol, selectedDroneId]);

  // Tick for re-render at ~10Hz
  useEffect(() => {
    if (frozen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, [frozen]);

  // Extract windowed data
  const windowedSamples = useMemo(() => {
    const now = Date.now();
    const cutoff = now - timeWindow * 1000;
    return samplesRef.current.filter((s) => s.timestamp >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, tick]);

  // Fallback: if no SCALED_IMU data, use attitude ring buffer for gyro rates
  const attitudeGyroFallback = useMemo(() => {
    if (windowedSamples.length > 0) return null;
    const now = Date.now();
    const cutoff = now - timeWindow * 1000;
    return attitudeRing.toArray().filter((a) => a.timestamp >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, tick, windowedSamples.length, attitudeRing.length]);

  const extractAxis = useCallback(
    (key: keyof ImuSample): number[] => windowedSamples.map((s) => s[key] as number),
    [windowedSamples],
  );

  const sampleCount = windowedSamples.length;
  const hasImuData = sampleCount > 0;
  const hasAttitudeFallback = !hasImuData && (attitudeGyroFallback?.length ?? 0) > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-bg-secondary">
        <Activity size={14} className="text-accent-primary" />
        <span className="text-xs font-semibold text-text-primary">Sensor Graphs</span>

        <div className="flex-1" />

        {/* Source tabs */}
        <div className="flex items-center gap-0.5 bg-bg-tertiary p-0.5 rounded">
          {SOURCE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSource(key)}
              className={cn(
                "px-2 py-1 text-[10px] cursor-pointer rounded transition-colors",
                source === key
                  ? "bg-bg-secondary text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time window */}
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(Number(e.target.value) as TimeWindow)}
          className="bg-bg-tertiary text-text-primary text-[10px] font-mono px-2 py-1 border border-border-default focus:outline-none focus:border-accent-primary cursor-pointer"
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {w}s
            </option>
          ))}
        </select>

        {/* Freeze / Resume */}
        <button
          onClick={() => setFrozen((f) => !f)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer",
            frozen ? "text-status-warning" : "text-text-secondary hover:text-text-primary",
          )}
        >
          {frozen ? <Pause size={10} /> : <Play size={10} />}
          {frozen ? "Frozen" : "Live"}
        </button>

        {hasImuData && (
          <span className="text-[9px] font-mono text-text-tertiary tabular-nums">
            {sampleCount} pts
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedDroneId ? (
          <EmptyState message="Connect a drone to view sensor data" />
        ) : source === "vibration" ? (
          /* ── Vibration tab ── */
          <div className="max-w-lg space-y-4">
            <SectionHeader title="Vibration" subtitle="IMU vibration levels (m/s/s)" />
            <VibrationGauges />
          </div>
        ) : source === "ekf" ? (
          /* ── EKF tab ── */
          <div className="max-w-lg space-y-4">
            <SectionHeader title="EKF Status" subtitle="Extended Kalman Filter variance" />
            <EkfStatusBars />
          </div>
        ) : !hasImuData && !hasAttitudeFallback ? (
          <EmptyState
            message={
              source === "mag"
                ? "Waiting for SCALED_IMU magnetometer data..."
                : `Waiting for SCALED_IMU ${source} data...`
            }
          />
        ) : source === "gyro" ? (
          /* ── Gyro tab ── */
          <div className="space-y-4">
            <SectionHeader title="Gyroscope" subtitle="Angular rate (deg/s)" />
            {hasImuData ? (
              <div className="space-y-2">
                <WaveformChart data={extractAxis("xgyro")} label="X" unit="deg/s" color={AXIS_COLORS.x} />
                <WaveformChart data={extractAxis("ygyro")} label="Y" unit="deg/s" color={AXIS_COLORS.y} />
                <WaveformChart data={extractAxis("zgyro")} label="Z" unit="deg/s" color={AXIS_COLORS.z} />
              </div>
            ) : hasAttitudeFallback && attitudeGyroFallback ? (
              /* Fallback: attitude ring buffer has roll/pitch/yaw rates */
              <div className="space-y-2">
                <p className="text-[9px] text-text-tertiary italic mb-1">
                  Using attitude rate data (SCALED_IMU not available)
                </p>
                <WaveformChart
                  data={attitudeGyroFallback.map((a) => a.rollSpeed)}
                  label="R"
                  unit="deg/s"
                  color={AXIS_COLORS.x}
                />
                <WaveformChart
                  data={attitudeGyroFallback.map((a) => a.pitchSpeed)}
                  label="P"
                  unit="deg/s"
                  color={AXIS_COLORS.y}
                />
                <WaveformChart
                  data={attitudeGyroFallback.map((a) => a.yawSpeed)}
                  label="Y"
                  unit="deg/s"
                  color={AXIS_COLORS.z}
                />
              </div>
            ) : null}
          </div>
        ) : source === "accel" ? (
          /* ── Accel tab ── */
          <div className="space-y-4">
            <SectionHeader title="Accelerometer" subtitle="Linear acceleration (m/s²)" />
            <div className="space-y-2">
              <WaveformChart data={extractAxis("xacc")} label="X" unit="m/s²" color={AXIS_COLORS.x} />
              <WaveformChart data={extractAxis("yacc")} label="Y" unit="m/s²" color={AXIS_COLORS.y} />
              <WaveformChart data={extractAxis("zacc")} label="Z" unit="m/s²" color={AXIS_COLORS.z} />
            </div>
          </div>
        ) : source === "mag" ? (
          /* ── Mag tab ── */
          <div className="space-y-4">
            <SectionHeader title="Magnetometer" subtitle="Magnetic field (mGauss)" />
            <div className="space-y-2">
              <WaveformChart data={extractAxis("xmag")} label="X" unit="mG" color={AXIS_COLORS.x} />
              <WaveformChart data={extractAxis("ymag")} label="Y" unit="mG" color={AXIS_COLORS.y} />
              <WaveformChart data={extractAxis("zmag")} label="Z" unit="mG" color={AXIS_COLORS.z} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      <p className="text-[10px] text-text-tertiary">{subtitle}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <Activity size={24} className="text-text-tertiary" />
      <span className="text-xs text-text-tertiary">{message}</span>
    </div>
  );
}
