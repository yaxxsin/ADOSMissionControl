"use client";

import { useState, useEffect } from "react";
import { Network, Wifi, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";
import { AgentDisconnectedPage } from "./AgentDisconnectedPage";
import type { MockNetwork } from "@/mock/mock-agent";

export function FleetNetworkTab() {
  const connected = useAgentStore((s) => s.connected);
  const [network, setNetwork] = useState<MockNetwork | null>(null);

  useEffect(() => {
    if (!connected) return;
    import("@/mock/mock-agent").then((mod) => setNetwork(mod.MOCK_NETWORK));
  }, [connected]);

  if (!connected || !network) {
    return <AgentDisconnectedPage />;
  }

  return (
    <div className="p-4 max-w-3xl space-y-4">
      {/* MQTT Status */}
      <div className="border border-border-default rounded-lg p-4 bg-bg-secondary">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={14} className="text-text-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            MQTT Gateway
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-text-tertiary">Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                network.mqtt.connected ? "bg-status-success" : "bg-status-error"
              )} />
              <span className="text-text-primary font-medium">
                {network.mqtt.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div>
            <span className="text-text-tertiary">Broker</span>
            <p className="text-text-secondary font-mono mt-0.5 text-[11px]">
              {network.mqtt.broker}
            </p>
          </div>
          <div>
            <span className="text-text-tertiary">Messages Sent</span>
            <p className="text-text-primary font-mono mt-0.5">
              {network.mqtt.messages_sent.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-text-tertiary">Messages Received</span>
            <p className="text-text-primary font-mono mt-0.5">
              {network.mqtt.messages_received.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Mesh Radio */}
      <div className="border border-border-default rounded-lg p-4 bg-bg-secondary">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={14} className="text-text-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Mesh Radio
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-text-tertiary">LoRa</span>
            <p className="text-text-secondary mt-0.5">
              {network.mesh.lora.installed ? "Installed" : "Not installed"}
            </p>
          </div>
          <div>
            <span className="text-text-tertiary">WiFi Direct</span>
            <p className="text-text-secondary mt-0.5">
              {network.mesh.wifi_direct.enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </div>

      {/* Peers */}
      <div className="border border-border-default rounded-lg p-4 bg-bg-secondary">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
          ADOS Peers
        </h3>
        {network.peers.length === 0 ? (
          <p className="text-xs text-text-tertiary">No peers discovered</p>
        ) : (
          <div className="space-y-2">
            {network.peers.map((peer) => (
              <div
                key={peer.id}
                className="flex items-center justify-between py-1.5 border-b border-border-default last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
                  <span className="text-xs text-text-primary font-medium">
                    {peer.name}
                  </span>
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {peer.id}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                  <span className="font-mono">{peer.signal_dbm} dBm</span>
                  <span>{peer.last_seen}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
