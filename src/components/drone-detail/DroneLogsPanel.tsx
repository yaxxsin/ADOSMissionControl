"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import {
  Download,
  Trash2,
  Pause,
  Play,
  Activity,
  Gauge,
  Battery,
  Signal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface LogMessage {
  id: number;
  timestamp: number;
  severity: number;
  text: string;
}

interface DroneLogsPanelProps {
  droneId: string;
}

// ── Severity mapping ─────────────────────────────────────────

const SEVERITY_LABELS = [
  "EMERGENCY",
  "ALERT",
  "CRITICAL",
  "ERROR",
  "WARNING",
  "NOTICE",
  "INFO",
  "DEBUG",
] as const;

const SEVERITY_COLORS: Record<number, string> = {
  0: "text-red-500",
  1: "text-red-500",
  2: "text-red-400",
  3: "text-red-400",
  4: "text-yellow-400",
  5: "text-blue-400",
  6: "text-green-400",
  7: "text-text-tertiary",
};

const SEVERITY_BG: Record<number, string> = {
  0: "bg-red-500/10",
  1: "bg-red-500/10",
  2: "bg-red-400/10",
  3: "bg-red-400/10",
  4: "bg-yellow-400/10",
  5: "bg-blue-400/10",
  6: "bg-green-400/10",
  7: "bg-transparent",
};

const MAX_LOG_MESSAGES = 1000;

// ── Graph channel config ─────────────────────────────────────

const GRAPH_CHANNELS = [
  { key: "altitude" as const, label: "Alt", icon: Activity, color: "#3A82FF" },
  { key: "speed" as const, label: "Spd", icon: Gauge, color: "#DFF140" },
  { key: "battery" as const, label: "Bat", icon: Battery, color: "#22c55e" },
  { key: "rssi" as const, label: "RSSI", icon: Signal, color: "#f97316" },
] as const;

type ChannelKey = (typeof GRAPH_CHANNELS)[number]["key"];

// ── Component ────────────────────────────────────────────────

export function DroneLogsPanel({ droneId }: DroneLogsPanelProps) {
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);

  // Status message log
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [minSeverity, setMinSeverity] = useState(7);
  const [autoscroll, setAutoscroll] = useState(true);

  // Graph
  const [showGraph, setShowGraph] = useState(false);
  const [activeChannels, setActiveChannels] = useState<Record<ChannelKey, boolean>>({
    altitude: true,
    speed: false,
    battery: false,
    rssi: false,
  });

  const logRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  // ── Subscribe to STATUSTEXT messages from the protocol ─────

  useEffect(() => {
    const protocol = getProtocol();
    if (!protocol) return;

    const unsub = protocol.onStatusText((data) => {
      setMessages((prev) => {
        const msg: LogMessage = {
          id: msgIdRef.current++,
          timestamp: Date.now(),
          severity: data.severity,
          text: data.text,
        };
        const next = [...prev, msg];
        return next.length > MAX_LOG_MESSAGES ? next.slice(-MAX_LOG_MESSAGES) : next;
      });
    });

    return unsub;
  }, [getProtocol, droneId]);

  // ── Auto-scroll log to bottom ──────────────────────────────

  useEffect(() => {
    if (autoscroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, autoscroll]);

  // ── Build graph data from telemetry ring buffers ───────────

  const vfrBuffer = useTelemetryStore((s) => s.vfr);
  const batteryBuffer = useTelemetryStore((s) => s.battery);
  const rcBuffer = useTelemetryStore((s) => s.rc);

  const vfrArr = vfrBuffer.toArray();
  const batteryArr = batteryBuffer.toArray();
  const rcArr = rcBuffer.toArray();

  const graphData = vfrArr.map((v, i) => ({
    time: i,
    altitude: v.alt,
    speed: v.groundspeed,
    battery: batteryArr[Math.min(i, batteryArr.length - 1)]?.voltage ?? 0,
    rssi: rcArr[Math.min(i, rcArr.length - 1)]?.rssi ?? 0,
  }));

  // ── Filtered messages ──────────────────────────────────────

  const filteredMessages = messages.filter((m) => m.severity <= minSeverity);

  // ── Export log to text file ────────────────────────────────

  const exportLog = useCallback(() => {
    const lines = filteredMessages.map((m) => {
      const time = new Date(m.timestamp).toISOString();
      const sev = SEVERITY_LABELS[m.severity] ?? "UNKNOWN";
      return `[${time}] [${sev}] ${m.text}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altnautica-log-${droneId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredMessages, droneId]);

  // ── Helpers ────────────────────────────────────────────────

  const toggleChannel = (key: ChannelKey) => {
    setActiveChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-default flex-wrap">
        {/* Severity filter */}
        <select
          value={minSeverity}
          onChange={(e) => setMinSeverity(Number(e.target.value))}
          className="bg-bg-tertiary text-text-primary text-[11px] px-1.5 py-1 border border-border-default focus:outline-none focus:border-accent-primary"
        >
          {SEVERITY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>

        <span className="text-[10px] text-text-tertiary font-mono">
          {filteredMessages.length} msgs
        </span>

        <div className="flex-1" />

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoscroll((p) => !p)}
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
            autoscroll ? "text-accent-primary" : "text-text-tertiary"
          }`}
          title={autoscroll ? "Auto-scroll on" : "Auto-scroll off"}
        >
          {autoscroll ? <Play size={10} /> : <Pause size={10} />}
          {autoscroll ? "Auto" : "Paused"}
        </button>

        {/* Export */}
        <button
          onClick={exportLog}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Export log"
        >
          <Download size={10} />
        </button>

        {/* Clear */}
        <button
          onClick={() => setMessages([])}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Clear log"
        >
          <Trash2 size={10} />
        </button>

        {/* Graph toggle */}
        <button
          onClick={() => setShowGraph((p) => !p)}
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
            showGraph ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
          }`}
          title={showGraph ? "Hide graph" : "Show graph"}
        >
          <Activity size={10} />
        </button>
      </div>

      {/* ── Message list ─────────────────────────────────────── */}
      <div
        ref={logRef}
        className="h-[300px] overflow-y-auto font-mono text-[11px] leading-5"
        onMouseEnter={() => setAutoscroll(false)}
        onMouseLeave={() => setAutoscroll(true)}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
            Waiting for status messages...
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 px-3 py-0.5 hover:bg-bg-tertiary/50 ${
                SEVERITY_BG[msg.severity] ?? ""
              }`}
            >
              <span className="text-text-tertiary shrink-0 w-[60px]">
                {formatTime(msg.timestamp)}
              </span>
              <span
                className={`shrink-0 w-[72px] font-semibold ${
                  SEVERITY_COLORS[msg.severity] ?? "text-text-tertiary"
                }`}
              >
                {SEVERITY_LABELS[msg.severity] ?? "?"}
              </span>
              <span className="text-text-primary break-all">{msg.text}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Telemetry graph (collapsible) ────────────────────── */}
      {showGraph && (
        <div className="border-t border-border-default">
          {/* Channel toggles */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border-default">
            {GRAPH_CHANNELS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => toggleChannel(key)}
                className={`flex items-center gap-1 text-[10px] transition-colors cursor-pointer ${
                  activeChannels[key] ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeChannels[key] ? color : "#333" }}
                />
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-[150px] bg-bg-secondary p-2">
            {graphData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#666" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#666" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111116",
                      border: "1px solid #333",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#888" }}
                  />
                  {activeChannels.altitude && (
                    <Line type="monotone" dataKey="altitude" stroke="#3A82FF" dot={false} strokeWidth={1.5} />
                  )}
                  {activeChannels.speed && (
                    <Line type="monotone" dataKey="speed" stroke="#DFF140" dot={false} strokeWidth={1.5} />
                  )}
                  {activeChannels.battery && (
                    <Line type="monotone" dataKey="battery" stroke="#22c55e" dot={false} strokeWidth={1.5} />
                  )}
                  {activeChannels.rssi && (
                    <Line type="monotone" dataKey="rssi" stroke="#f97316" dot={false} strokeWidth={1.5} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
                Telemetry data will appear here when connected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
