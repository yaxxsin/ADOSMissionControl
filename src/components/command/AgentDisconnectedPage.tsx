"use client";

/**
 * @module AgentDisconnectedPage
 * @description Pairing-first page shown when no agent is connected.
 * Guides the user through installing the agent and entering a pairing code.
 * Falls back to capability info and manual connection for advanced users.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import {
  ArrowUpRight,
  Radio,
  Globe,
  Monitor,
  Terminal,
  Cog,
  Code2,
  AlertTriangle,
  Cpu,
  Copy,
  Check,
  Wifi,
} from "lucide-react";
import { usePairingStore, type DiscoveredAgent } from "@/stores/pairing-store";
import { PairingCodeInput } from "./PairingDialog";

const capabilities = [
  {
    icon: Radio,
    title: "MAVLink Proxy",
    description:
      "Routes flight controller data over WebSocket, TCP, and UDP. Bidirectional relay with auto-reconnect.",
  },
  {
    icon: Globe,
    title: "REST API",
    description:
      "Full HTTP API at :8080 for agent status, telemetry, parameters, commands, configuration, and logs.",
  },
  {
    icon: Monitor,
    title: "TUI Dashboard",
    description:
      "SSH-friendly terminal interface with 5 screens: dashboard, telemetry, MAVLink inspector, config editor, and log viewer.",
  },
  {
    icon: Terminal,
    title: "CLI Tools",
    description:
      "`ados status`, `ados health`, `ados config`, `ados mavlink` and more. Quick diagnostics without a browser.",
  },
  {
    icon: Cog,
    title: "systemd Service",
    description:
      "Auto-start on boot, watchdog monitoring, graceful shutdown. Install with a single curl command.",
  },
  {
    icon: Code2,
    title: "Scripting",
    description:
      "Text commands, Python SDK, YAML missions, REST API. Five tiers from simple to advanced.",
  },
];

const INSTALL_COMMAND = "curl -sSL https://raw.githubusercontent.com/altnautica/ADOSDroneAgent/main/scripts/install.sh | sudo bash";

interface AgentDisconnectedPageProps {
  onOpenPairing?: () => void;
}

export function AgentDisconnectedPage({ onOpenPairing }: AgentDisconnectedPageProps) {
  const [copied, setCopied] = useState(false);
  const [pairingSubmitted, setPairingSubmitted] = useState(false);

  const discoveredAgents = usePairingStore((s) => s.discoveredAgents);

  function handleCopy() {
    navigator.clipboard.writeText(INSTALL_COMMAND).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCodeSubmit(code: string) {
    setPairingSubmitted(true);
    // The actual pairing flow is handled by PairingDialog, opened via onOpenPairing.
    // This inline input opens the full dialog with the code pre-filled.
    onOpenPairing?.();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
            <AlertTriangle size={12} />
            ALPHA
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary">
            Pair Your Drone
          </h1>
          <p className="text-text-secondary text-sm max-w-lg mx-auto">
            Connect the ADOS Drone Agent running on your companion computer to
            start managing your drone.
          </p>
        </div>

        {/* Three-step flow */}
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Step 1: Install */}
          <div className="p-4 bg-bg-secondary border border-border-default rounded space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-primary/15 text-accent-primary text-xs font-bold shrink-0">
                1
              </span>
              <span className="text-xs font-medium text-text-primary">
                Install the agent on your drone
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-bg-primary border border-border-default rounded ml-8">
              <code className="flex-1 text-[11px] font-mono text-text-secondary select-all truncate">
                {INSTALL_COMMAND}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-text-tertiary hover:text-text-primary bg-bg-secondary border border-border-default rounded transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={10} className="text-status-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-text-tertiary ml-8">
              Works on Raspberry Pi OS, Ubuntu, and most Debian-based systems. Requires Python 3.11+.
            </p>
          </div>

          {/* Step 2: Pairing code */}
          <div className="p-4 bg-bg-secondary border border-border-default rounded space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-primary/15 text-accent-primary text-xs font-bold shrink-0">
                2
              </span>
              <span className="text-xs font-medium text-text-primary">
                Enter the pairing code
              </span>
            </div>
            <div className="flex justify-center py-2">
              <PairingCodeInput
                onSubmit={handleCodeSubmit}
                disabled={pairingSubmitted}
              />
            </div>
            <p className="text-[10px] text-text-tertiary text-center">
              The 6-character code is shown when the agent starts. Or{" "}
              <button
                onClick={onOpenPairing}
                className="text-accent-primary hover:underline"
              >
                open the full pairing dialog
              </button>{" "}
              for more options.
            </p>
          </div>

          {/* Step 3: Connected */}
          <div className="p-4 bg-bg-secondary border border-border-default/50 rounded space-y-2 opacity-50">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-primary/15 text-accent-primary text-xs font-bold shrink-0">
                3
              </span>
              <span className="text-xs font-medium text-text-primary">
                Connected and ready
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary ml-8">
              Once paired, your drone appears in the sidebar. Click to connect any time.
            </p>
          </div>
        </div>

        {/* Discovered agents */}
        {discoveredAgents.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-medium text-text-primary flex items-center gap-2">
              <Wifi size={12} className="text-status-success" />
              Discovered on your network
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {discoveredAgents.map((agent) => (
                <button
                  key={agent.deviceId}
                  onClick={onOpenPairing}
                  className="flex items-center gap-3 p-3 bg-bg-secondary border border-border-default rounded hover:border-accent-primary/40 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center shrink-0">
                    <Cpu size={14} className="text-accent-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {agent.name}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {agent.board} &middot;{" "}
                      <span className="font-mono">{agent.pairingCode}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Capabilities grid */}
        <div>
          <h2 className="text-sm font-medium text-text-primary mb-4">
            What the ADOS Agent does
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-4 bg-bg-secondary border border-border-default rounded space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-accent-primary" />
                  <span className="text-xs font-medium text-text-primary">
                    {title}
                  </span>
                </div>
                <p className="text-[11px] text-text-tertiary leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Alpha Disclaimer */}
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded">
          <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200/80 leading-relaxed">
            This is alpha software. Expect bugs, breaking changes, and
            incomplete features. The Command tab provides direct control over
            drone agent services and configuration. Use at your own risk.
          </p>
        </div>

        {/* Requirements */}
        <div className="text-center space-y-3">
          <h2 className="text-sm font-medium text-text-primary">
            Requirements
          </h2>
          <div className="inline-flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <Cpu size={12} />
              Python 3.11+
            </span>
            <span className="text-border-default">|</span>
            <span>Linux (Raspberry Pi OS recommended)</span>
            <span className="text-border-default">|</span>
            <span>ArduPilot or PX4 flight controller</span>
          </div>
        </div>

        {/* GitHub link */}
        <div className="text-center pb-6">
          <a
            href="https://github.com/altnautica/ADOSDroneAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-text-primary bg-bg-tertiary border border-border-default rounded hover:bg-bg-secondary transition-colors"
          >
            View on GitHub
            <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
