"use client";

/**
 * @module QuickGraphs
 * @description Quick telemetry graphs — altitude, battery, climb rate,
 * vibration levels (X/Y/Z with thresholds), and RC inputs (ch1-4).
 * Uses inline SVG charts (same pattern as DebugPanel).
 * Reads from telemetry-store ring buffers.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { Mountain, Battery, TrendingUp, Activity, Radio } from "lucide-react";
import type { PositionData, BatteryData, VibrationData, RcData } from "@/lib/types";

// ── Shared chart component ─────────────────────────────────────

interface ChartPoint {
  t: number;
  v: number;
}

function TimeSeriesChart({
  data,
  color,
  label,
  unit,
  width = 500,
  height = 100,
  secondaryData,
  secondaryColor,
  secondaryLabel,
  secondaryUnit,
}: {
  data: ChartPoint[];
  color: string;
  label: string;
  unit: string;
  width?: number;
  height?: number;
  secondaryData?: ChartPoint[];
  secondaryColor?: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center bg-bg-tertiary/30 rounded"
        style={{ width, height }}
      >
        <span className="text-[10px] text-text-tertiary">
          Waiting for data...
        </span>
      </div>
    );
  }

  const pad = 4;
  const chartW = width;
  const chartH = height;

  // Primary series
  const minV = Math.min(...data.map((d) => d.v));
  const maxV = Math.max(...data.map((d) => d.v));
  const range = maxV - minV || 1;
  const tMin = data[0].t;
  const tMax = data[data.length - 1].t;
  const tRange = tMax - tMin || 1;

  const points = data
    .map((d) => {
      const x = ((d.t - tMin) / tRange) * (chartW - pad * 2) + pad;
      const y =
        chartH - pad - ((d.v - minV) / range) * (chartH - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Secondary series (if provided)
  let secondaryPoints = "";
  let secMin = 0;
  let secMax = 0;
  if (secondaryData && secondaryData.length >= 2) {
    secMin = Math.min(...secondaryData.map((d) => d.v));
    secMax = Math.max(...secondaryData.map((d) => d.v));
    const secRange = secMax - secMin || 1;
    secondaryPoints = secondaryData
      .map((d) => {
        const x = ((d.t - tMin) / tRange) * (chartW - pad * 2) + pad;
        const y =
          chartH - pad - ((d.v - secMin) / secRange) * (chartH - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const latest = data[data.length - 1];
  const secLatest = secondaryData?.[secondaryData.length - 1];
  const duration = (tMax - tMin) / 1000;

  return (
    <div>
      <svg
        width={chartW}
        height={chartH}
        className="bg-bg-tertiary/30 rounded"
      >
        {/* Mid line */}
        <line
          x1="0"
          y1={chartH / 2}
          x2={chartW}
          y2={chartH / 2}
          stroke="var(--border-default)"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
        {/* Primary series */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
        {/* Secondary series */}
        {secondaryPoints && secondaryColor && (
          <polyline
            points={secondaryPoints}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1.5"
            strokeDasharray="3,2"
          />
        )}
        {/* Y axis labels — primary */}
        <text
          x={3}
          y={12}
          fill="var(--text-tertiary)"
          fontSize="8"
          fontFamily="monospace"
        >
          {maxV.toFixed(1)}
          {unit}
        </text>
        <text
          x={3}
          y={chartH - 3}
          fill="var(--text-tertiary)"
          fontSize="8"
          fontFamily="monospace"
        >
          {minV.toFixed(1)}
          {unit}
        </text>
        {/* Y axis labels — secondary (right side) */}
        {secondaryData && secondaryData.length >= 2 && (
          <>
            <text
              x={chartW - 3}
              y={12}
              fill="var(--text-tertiary)"
              fontSize="8"
              fontFamily="monospace"
              textAnchor="end"
            >
              {secMax.toFixed(1)}
              {secondaryUnit}
            </text>
            <text
              x={chartW - 3}
              y={chartH - 3}
              fill="var(--text-tertiary)"
              fontSize="8"
              fontFamily="monospace"
              textAnchor="end"
            >
              {secMin.toFixed(1)}
              {secondaryUnit}
            </text>
          </>
        )}
      </svg>
      <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-text-tertiary">
        <div className="flex items-center gap-3">
          <span style={{ color }}>
            {label}: {latest.v.toFixed(2)}
            {unit}
          </span>
          {secLatest && secondaryColor && secondaryLabel && (
            <span style={{ color: secondaryColor }}>
              {secondaryLabel}: {secLatest.v.toFixed(2)}
              {secondaryUnit}
            </span>
          )}
        </div>
        <span>
          {data.length} pts / {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

// ── Altitude chart ──────────────────────────────────────────────

function AltitudeChart() {
  const positionRing = useTelemetryStore((s) => s.position);
  const version = useTelemetryStore((s) => s._version);

  const data = useMemo(() => {
    // version forces re-compute
    void version;
    const arr = positionRing.toArray() as PositionData[];
    return arr.map((p) => ({ t: p.timestamp, v: p.relativeAlt }));
  }, [positionRing, version]);

  return (
    <div className="border border-border-default bg-bg-secondary p-3">
      <div className="flex items-center gap-2 mb-2">
        <Mountain size={12} className="text-accent-primary" />
        <span className="text-xs font-semibold text-text-primary">
          Altitude
        </span>
      </div>
      <TimeSeriesChart data={data} color="var(--accent-primary)" label="Alt" unit="m" />
    </div>
  );
}

// ── Battery chart ───────────────────────────────────────────────

function BatteryChart() {
  const batteryRing = useTelemetryStore((s) => s.battery);
  const version = useTelemetryStore((s) => s._version);

  const { voltageData, currentData } = useMemo(() => {
    void version;
    const arr = batteryRing.toArray() as BatteryData[];
    return {
      voltageData: arr.map((b) => ({ t: b.timestamp, v: b.voltage })),
      currentData: arr.map((b) => ({ t: b.timestamp, v: b.current })),
    };
  }, [batteryRing, version]);

  return (
    <div className="border border-border-default bg-bg-secondary p-3">
      <div className="flex items-center gap-2 mb-2">
        <Battery size={12} className="text-status-warning" />
        <span className="text-xs font-semibold text-text-primary">
          Battery
        </span>
      </div>
      <TimeSeriesChart
        data={voltageData}
        color="#f59e0b"
        label="Voltage"
        unit="V"
        secondaryData={currentData}
        secondaryColor="#ef4444"
        secondaryLabel="Current"
        secondaryUnit="A"
      />
    </div>
  );
}

// ── Climb rate chart ────────────────────────────────────────────

function ClimbRateChart() {
  const positionRing = useTelemetryStore((s) => s.position);
  const version = useTelemetryStore((s) => s._version);

  const data = useMemo(() => {
    void version;
    const arr = positionRing.toArray() as PositionData[];
    return arr.map((p) => ({ t: p.timestamp, v: p.climbRate }));
  }, [positionRing, version]);

  return (
    <div className="border border-border-default bg-bg-secondary p-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={12} className="text-status-success" />
        <span className="text-xs font-semibold text-text-primary">
          Climb Rate
        </span>
      </div>
      <TimeSeriesChart data={data} color="#22c55e" label="VSpd" unit="m/s" />
    </div>
  );
}

// ── Multi-series chart (for vibration & RC) ─────────────────────

interface MultiSeries {
  data: ChartPoint[];
  color: string;
  label: string;
}

interface ThresholdLine {
  value: number;
  color: string;
  label: string;
}

function MultiSeriesChart({
  series,
  unit,
  width = 500,
  height = 120,
  thresholds,
  fixedYMin,
  fixedYMax,
  centerLine,
}: {
  series: MultiSeries[];
  unit: string;
  width?: number;
  height?: number;
  thresholds?: ThresholdLine[];
  fixedYMin?: number;
  fixedYMax?: number;
  centerLine?: number;
}) {
  // Find global time range across all series
  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length < 2) {
    return (
      <div
        className="flex items-center justify-center bg-bg-tertiary/30 rounded"
        style={{ width, height }}
      >
        <span className="text-[10px] text-text-tertiary">
          Waiting for data...
        </span>
      </div>
    );
  }

  const pad = 4;
  const chartW = width;
  const chartH = height;

  const tMin = Math.min(...allPoints.map((d) => d.t));
  const tMax = Math.max(...allPoints.map((d) => d.t));
  const tRange = tMax - tMin || 1;

  // Global Y range (include thresholds in range calculation)
  const allValues = allPoints.map((d) => d.v);
  if (thresholds) {
    for (const th of thresholds) allValues.push(th.value);
  }
  if (centerLine !== undefined) allValues.push(centerLine);
  const minV = fixedYMin ?? Math.min(...allValues);
  const maxV = fixedYMax ?? Math.max(...allValues);
  const range = maxV - minV || 1;

  function toX(t: number) {
    return ((t - tMin) / tRange) * (chartW - pad * 2) + pad;
  }
  function toY(v: number) {
    return chartH - pad - ((v - minV) / range) * (chartH - pad * 2);
  }

  const duration = (tMax - tMin) / 1000;

  return (
    <div>
      <svg
        width={chartW}
        height={chartH}
        className="bg-bg-tertiary/30 rounded"
      >
        {/* Center line */}
        {centerLine !== undefined && (
          <line
            x1={pad}
            y1={toY(centerLine)}
            x2={chartW - pad}
            y2={toY(centerLine)}
            stroke="var(--border-default)"
            strokeWidth="0.5"
            strokeDasharray="4,4"
          />
        )}
        {/* Threshold lines */}
        {thresholds?.map((th) => (
          <g key={th.label}>
            <line
              x1={pad}
              y1={toY(th.value)}
              x2={chartW - pad}
              y2={toY(th.value)}
              stroke={th.color}
              strokeWidth="0.5"
              strokeDasharray="6,3"
              opacity={0.6}
            />
            <text
              x={chartW - pad - 2}
              y={toY(th.value) - 2}
              fill={th.color}
              fontSize="7"
              fontFamily="monospace"
              textAnchor="end"
              opacity={0.7}
            >
              {th.label}
            </text>
          </g>
        ))}
        {/* Data series */}
        {series.map((s) => {
          if (s.data.length < 2) return null;
          const pts = s.data
            .map((d) => `${toX(d.t)},${toY(d.v)}`)
            .join(" ");
          return (
            <polyline
              key={s.label}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth="1.5"
            />
          );
        })}
        {/* Y axis labels */}
        <text x={3} y={12} fill="var(--text-tertiary)" fontSize="8" fontFamily="monospace">
          {maxV.toFixed(0)}{unit}
        </text>
        <text x={3} y={chartH - 3} fill="var(--text-tertiary)" fontSize="8" fontFamily="monospace">
          {minV.toFixed(0)}{unit}
        </text>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-text-tertiary">
        <div className="flex items-center gap-3">
          {series.map((s) => {
            const latest = s.data[s.data.length - 1];
            return (
              <span key={s.label} style={{ color: s.color }}>
                {s.label}: {latest?.v.toFixed(1) ?? "--"}{unit}
              </span>
            );
          })}
        </div>
        <span>
          {allPoints.length} pts / {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

// ── Vibration chart (X/Y/Z with threshold lines) ───────────────

function VibrationChart() {
  const vibrationRing = useTelemetryStore((s) => s.vibration);
  const version = useTelemetryStore((s) => s._version);

  const { xData, yData, zData } = useMemo(() => {
    void version;
    const arr = vibrationRing.toArray() as VibrationData[];
    return {
      xData: arr.map((v) => ({ t: v.timestamp, v: v.vibrationX })),
      yData: arr.map((v) => ({ t: v.timestamp, v: v.vibrationY })),
      zData: arr.map((v) => ({ t: v.timestamp, v: v.vibrationZ })),
    };
  }, [vibrationRing, version]);

  return (
    <div className="border border-border-default bg-bg-secondary p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity size={12} className="text-status-error" />
        <span className="text-xs font-semibold text-text-primary">
          Vibration
        </span>
      </div>
      <MultiSeriesChart
        series={[
          { data: xData, color: "#ef4444", label: "X" },
          { data: yData, color: "#22c55e", label: "Y" },
          { data: zData, color: "#3b82f6", label: "Z" },
        ]}
        unit=" m/s\u00B2"
        thresholds={[
          { value: 30, color: "#f59e0b", label: "30 warn" },
          { value: 60, color: "#ef4444", label: "60 crit" },
        ]}
        fixedYMin={0}
      />
    </div>
  );
}

// ── RC inputs chart (channels 1-4) ─────────────────────────────

function RcInputChart() {
  const rcRing = useTelemetryStore((s) => s.rc);
  const version = useTelemetryStore((s) => s._version);

  const { ch1, ch2, ch3, ch4 } = useMemo(() => {
    void version;
    const arr = rcRing.toArray() as RcData[];
    return {
      ch1: arr.map((r) => ({ t: r.timestamp, v: r.channels[0] ?? 1500 })),
      ch2: arr.map((r) => ({ t: r.timestamp, v: r.channels[1] ?? 1500 })),
      ch3: arr.map((r) => ({ t: r.timestamp, v: r.channels[2] ?? 1500 })),
      ch4: arr.map((r) => ({ t: r.timestamp, v: r.channels[3] ?? 1500 })),
    };
  }, [rcRing, version]);

  return (
    <div className="border border-border-default bg-bg-secondary p-3">
      <div className="flex items-center gap-2 mb-2">
        <Radio size={12} className="text-accent-primary" />
        <span className="text-xs font-semibold text-text-primary">
          RC Inputs
        </span>
      </div>
      <MultiSeriesChart
        series={[
          { data: ch1, color: "#ef4444", label: "Roll" },
          { data: ch2, color: "#22c55e", label: "Pitch" },
          { data: ch3, color: "#f59e0b", label: "Thr" },
          { data: ch4, color: "#8b5cf6", label: "Yaw" },
        ]}
        unit=" PWM"
        fixedYMin={1000}
        fixedYMax={2000}
        centerLine={1500}
      />
    </div>
  );
}

// ── Composite export ────────────────────────────────────────────

export function QuickGraphs() {
  return (
    <div className="space-y-3">
      <AltitudeChart />
      <BatteryChart />
      <ClimbRateChart />
      <VibrationChart />
      <RcInputChart />
    </div>
  );
}
