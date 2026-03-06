"use client";

/**
 * @module AgentOverviewTab
 * @description Main overview tab showing agent status, services, resources, CPU sparkline, and logs.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useAgentStore } from "@/stores/agent-store";
import { AgentStatusCard } from "./shared/AgentStatusCard";
import { ServiceTable } from "./shared/ServiceTable";
import { SystemResourceGauges } from "./shared/SystemResourceGauges";
import { CpuSparkline } from "./shared/CpuSparkline";
import { LogViewer } from "./shared/LogViewer";
import { AgentDisconnectedPage } from "./AgentDisconnectedPage";

export function AgentOverviewTab() {
  const connected = useAgentStore((s) => s.connected);
  const status = useAgentStore((s) => s.status);
  const services = useAgentStore((s) => s.services);
  const resources = useAgentStore((s) => s.resources);
  const logs = useAgentStore((s) => s.logs);
  const fetchServices = useAgentStore((s) => s.fetchServices);
  const fetchResources = useAgentStore((s) => s.fetchResources);
  const fetchLogs = useAgentStore((s) => s.fetchLogs);
  const restartService = useAgentStore((s) => s.restartService);

  useEffect(() => {
    if (connected) {
      fetchServices();
      fetchResources();
      fetchLogs();
    }
  }, [connected, fetchServices, fetchResources, fetchLogs]);

  if (!connected || !status) {
    return <AgentDisconnectedPage />;
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <AgentStatusCard status={status} />

      {/* Connection details */}
      {status.fc_connected && (
        <div className="border border-border-default rounded-lg p-3 bg-bg-secondary">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-text-tertiary">FC Port</span>
              <p className="text-text-primary font-mono mt-0.5">{status.fc_port}</p>
            </div>
            <div>
              <span className="text-text-tertiary">Baud Rate</span>
              <p className="text-text-primary font-mono mt-0.5">{status.fc_baud.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-text-tertiary">Flight Mode</span>
              <p className="text-accent-primary font-mono mt-0.5">{status.mode}</p>
            </div>
            <div>
              <span className="text-text-tertiary">GPS</span>
              <p className="text-text-primary font-mono mt-0.5">
                {status.gps_fix}D Fix / {status.satellites} sats
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ServiceTable services={services} onRestart={restartService} />
        <div className="space-y-4">
          {resources && <SystemResourceGauges resources={resources} />}
          <CpuSparkline />
        </div>
      </div>

      <LogViewer logs={logs} onRefresh={fetchLogs} />
    </div>
  );
}
