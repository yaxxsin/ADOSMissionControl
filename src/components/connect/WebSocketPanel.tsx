"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plug } from "lucide-react";
import { WebSocketTransport } from "@/lib/protocol/transport-websocket";
import { MAVLinkAdapter } from "@/lib/protocol/mavlink-adapter";
import { useDroneManager } from "@/stores/drone-manager";
import { randomId } from "@/lib/utils";

const QUICK_PRESETS = [
  { label: "mavlink-router", url: "ws://localhost:14550" },
  { label: "SITL", url: "ws://localhost:5760" },
  { label: "Secondary", url: "ws://localhost:14555" },
];

export function WebSocketPanel({
  onConnected,
}: {
  onConnected?: (name: string, type: "websocket", url: string) => void;
}) {
  const [url, setUrl] = useState("ws://localhost:14550");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addDrone = useDroneManager((s) => s.addDrone);

  async function handleConnect() {
    setError(null);
    const trimmed = url.trim();

    if (!trimmed) {
      setError("URL is required");
      return;
    }
    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
      setError("URL must start with ws:// or wss://");
      return;
    }

    setConnecting(true);
    try {
      const transport = new WebSocketTransport();
      await transport.connect(trimmed);

      const adapter = new MAVLinkAdapter();
      const vehicleInfo = await adapter.connect(transport);
      const droneId = randomId();
      const droneName = `${vehicleInfo.firmwareVersionString} (${vehicleInfo.vehicleClass})`;

      addDrone(droneId, droneName, adapter, transport, vehicleInfo, {
        type: "websocket",
        url: trimmed,
      });
      onConnected?.(droneName, "websocket", trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        label="WebSocket URL"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        placeholder="ws://localhost:14550"
      />

      {/* Quick-connect presets */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset.url}
            onClick={() => setUrl(preset.url)}
            className={`px-2 py-1 text-[10px] font-mono border transition-colors cursor-pointer ${
              url === preset.url
                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                : "border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong"
            }`}
          >
            {preset.label} — {preset.url.replace("ws://", "")}
          </button>
        ))}
      </div>

      <Button
        onClick={handleConnect}
        loading={connecting}
        icon={<Plug size={14} />}
      >
        {connecting ? "Connecting..." : "Connect"}
      </Button>

      <p className="text-[10px] text-text-tertiary">
        For UDP connections (e.g. 14550), run{" "}
        <code className="text-text-secondary">mavlink-router</code> as a
        WebSocket bridge
      </p>

      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}
