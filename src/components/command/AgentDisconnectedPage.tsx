"use client";

/**
 * @module AgentDisconnectedPage
 * @description Rich informational page shown when no agent is connected.
 * Explains the ADOS Drone Agent, its capabilities, and how to get started.
 * @license GPL-3.0-only
 */

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
} from "lucide-react";

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

const steps = [
  "Install the agent on a Raspberry Pi CM4 or any Linux SBC",
  "Run `ados start` or enable the systemd service",
  "Enter the agent's IP:8080 in the URL bar above and click Connect",
];

export function AgentDisconnectedPage() {
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
            ADOS Drone Agent
          </h1>
          <p className="text-text-secondary text-sm max-w-lg mx-auto">
            The software layer that turns any companion computer into a smart,
            autonomous drone platform.
          </p>
        </div>

        {/* What is this? */}
        <div className="text-center space-y-2">
          <h2 className="text-sm font-medium text-text-primary">
            What is this?
          </h2>
          <p className="text-xs text-text-secondary max-w-xl mx-auto leading-relaxed">
            This tab manages the ADOS Drone Agent, the software that runs on
            your drone&apos;s companion computer. It handles MAVLink routing,
            video streaming, sensor management, scripting, and fleet networking.
          </p>
        </div>

        {/* Capabilities grid */}
        <div>
          <h2 className="text-sm font-medium text-text-primary mb-4">
            Capabilities
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

        {/* Getting Started */}
        <div>
          <h2 className="text-sm font-medium text-text-primary mb-4">
            Getting Started
          </h2>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-bg-secondary border border-border-default rounded"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-primary/15 text-accent-primary text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {step}
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
