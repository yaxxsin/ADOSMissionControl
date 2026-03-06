"use client";

/**
 * @module CommandPage
 * @description Main layout for the Command tab with fleet sidebar, sub-tab switching, and drone context rail.
 * @license GPL-3.0-only
 */

import { useState, useEffect } from "react";
import {
  Monitor,
  TerminalSquare,
  Radio,
  Network,
  Package,
  Plug,
  Unplug,
  Loader2,
} from "lucide-react";
import { cn, isDemoMode } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";
import { useHasCommandAccess } from "@/hooks/use-has-command-access";
import { CommandLockedPage } from "./CommandLockedPage";
import { CommandFleetPanel } from "./CommandFleetPanel";
import { AgentOverviewTab } from "./AgentOverviewTab";
import { ScriptsTab } from "./ScriptsTab";
import { PeripheralsTab } from "./PeripheralsTab";
import { FleetNetworkTab } from "./FleetNetworkTab";
import { ModuleStoreTab } from "./ModuleStoreTab";
import { DroneContextRail } from "./shared/DroneContextRail";

type SubTab = "overview" | "scripts" | "peripherals" | "fleet" | "modules";

const subTabs = [
  { id: "overview" as const, label: "Overview", icon: Monitor },
  { id: "scripts" as const, label: "Scripts", icon: TerminalSquare },
  { id: "peripherals" as const, label: "Peripherals", icon: Radio },
  { id: "fleet" as const, label: "Fleet Network", icon: Network },
  { id: "modules" as const, label: "Module Store", icon: Package },
];

export function CommandPage() {
  const { hasAccess, isLoading, profile } = useHasCommandAccess();
  const [activeTab, setActiveTab] = useState<SubTab>("overview");
  const [urlInput, setUrlInput] = useState("http://localhost:8080");
  const [fleetCollapsed, setFleetCollapsed] = useState(false);

  const connected = useAgentStore((s) => s.connected);
  const connectionError = useAgentStore((s) => s.connectionError);
  const status = useAgentStore((s) => s.status);
  const connect = useAgentStore((s) => s.connect);
  const disconnect = useAgentStore((s) => s.disconnect);

  const demo = isDemoMode();

  useEffect(() => {
    return () => {
      useAgentStore.getState().stopPolling();
    };
  }, []);

  function handleConnect() {
    if (urlInput.trim()) {
      connect(urlInput.trim());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConnect();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!hasAccess) {
    return <CommandLockedPage profile={profile} />;
  }

  return (
    <div className="flex h-full">
      <CommandFleetPanel
        collapsed={fleetCollapsed}
        onToggleCollapse={() => setFleetCollapsed((v) => !v)}
      />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Connection bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-bg-secondary">
          {demo && connected && status ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-success" />
              <span className="text-xs text-text-primary font-medium">
                Demo Agent
              </span>
              <span className="text-xs text-text-tertiary">
                v{status.version}
              </span>
              <span className="text-xs text-text-tertiary">
                Tier {status.tier}
              </span>
              <span className="text-xs text-text-tertiary">{status.board}</span>
            </div>
          ) : connected && status ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                <span className="text-xs text-text-primary font-medium">
                  {status.name}
                </span>
                <span className="text-xs text-text-tertiary">
                  v{status.version}
                </span>
                <span className="text-xs text-text-tertiary">
                  Tier {status.tier}
                </span>
                <span className="text-xs text-text-tertiary">{status.board}</span>
              </div>
              <div className="ml-auto">
                <button
                  onClick={disconnect}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-status-error hover:bg-bg-tertiary rounded transition-colors"
                >
                  <Unplug size={12} />
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="text-xs text-text-secondary">Agent URL</label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="http://localhost:8080"
                className="flex-1 max-w-sm px-2.5 py-1 text-xs bg-bg-tertiary border border-border-default rounded text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
              />
              <button
                onClick={handleConnect}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-accent-primary text-white rounded hover:opacity-90 transition-opacity"
              >
                <Plug size={12} />
                Connect
              </button>
              {connectionError && (
                <span className="text-xs text-status-error">{connectionError}</span>
              )}
            </>
          )}
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center gap-1 px-4 border-b border-border-default bg-bg-secondary">
          {subTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                activeTab === id
                  ? "text-accent-primary border-b-2 border-accent-primary"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "overview" && <AgentOverviewTab />}
          {activeTab === "scripts" && <ScriptsTab />}
          {activeTab === "peripherals" && <PeripheralsTab />}
          {activeTab === "fleet" && <FleetNetworkTab />}
          {activeTab === "modules" && <ModuleStoreTab />}
        </div>
      </div>
      {connected && <DroneContextRail />}
    </div>
  );
}
