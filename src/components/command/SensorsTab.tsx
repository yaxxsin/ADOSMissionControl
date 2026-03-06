"use client";

import { useState, useEffect } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";
import type { MockSensor } from "@/mock/mock-agent";

const statusColor: Record<string, string> = {
  ok: "bg-status-success",
  warning: "bg-status-warning",
  error: "bg-status-error",
};

export function SensorsTab() {
  const connected = useAgentStore((s) => s.connected);
  const [sensors, setSensors] = useState<MockSensor[]>([]);

  useEffect(() => {
    if (!connected) return;
    import("@/mock/mock-agent").then((mod) => setSensors(mod.MOCK_SENSORS));
  }, [connected]);

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-sm">
          <Radio size={32} className="text-text-tertiary mx-auto" />
          <h3 className="text-sm font-medium text-text-primary">
            Sensor Discovery
          </h3>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Connect to an agent to view detected sensors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Detected Sensors
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sensors.map((sensor) => (
          <div
            key={sensor.name}
            className="border border-border-default rounded-lg p-3 bg-bg-secondary"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {sensor.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    statusColor[sensor.status] ?? "bg-text-tertiary"
                  )}
                />
                <span className="text-[10px] text-text-tertiary uppercase">
                  {sensor.status}
                </span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-text-tertiary">
              <div className="flex justify-between">
                <span>Type</span>
                <span className="text-text-secondary font-mono">
                  {sensor.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bus</span>
                <span className="text-text-secondary font-mono">
                  {sensor.bus}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Address</span>
                <span className="text-text-secondary font-mono">
                  {sensor.address}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="text-text-secondary font-mono">
                  {sensor.rate_hz} Hz
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border-default">
              <span className="text-[10px] text-text-tertiary">Last reading</span>
              <p className="text-xs text-text-secondary font-mono mt-0.5">
                {sensor.last_reading}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
