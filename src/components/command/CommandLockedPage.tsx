"use client";

/**
 * @module CommandLockedPage
 * @description Locked page shown when user doesn't have alpha tester or admin access.
 * Shows product info, capabilities, and alpha application CTA.
 * @license GPL-3.0-only
 */

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import {
  ArrowUpRight,
  Radio,
  Globe,
  Monitor,
  Terminal,
  Cog,
  Code2,
  AlertTriangle,
  Clock,
  LogIn,
} from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { SignInModal } from "@/components/auth/SignInModal";
import { useConvexAvailable } from "@/app/ConvexClientProvider";

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

interface CommandLockedPageProps {
  profile: Record<string, unknown> | null;
}

export function CommandLockedPage({ profile }: CommandLockedPageProps) {
  const convexAvailable = useConvexAvailable();
  const applyForAlpha = useMutation(communityApi.profiles.applyForAlpha);
  const [showSignIn, setShowSignIn] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pendingApply, setPendingApply] = useState(false);

  const isSignedIn = profile !== null;
  const hasApplied = isSignedIn && !!(profile as Record<string, unknown>)?.alphaAppliedAt;

  // After sign-in completes, auto-apply if the user clicked "Apply" before signing in
  useEffect(() => {
    if (pendingApply && isSignedIn && !hasApplied) {
      setPendingApply(false);
      handleApply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApply, isSignedIn]);

  async function handleApply() {
    if (!isSignedIn) {
      setPendingApply(true);
      setShowSignIn(true);
      return;
    }
    if (hasApplied || applying) return;
    setApplying(true);
    try {
      await applyForAlpha({});
    } finally {
      setApplying(false);
    }
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
            ADOS Drone Agent
          </h1>
          <p className="text-text-secondary text-sm max-w-lg mx-auto">
            The software layer that turns any companion computer into a smart,
            autonomous drone platform.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded">
          <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200/80 leading-relaxed">
            This is alpha software. Expect bugs, breaking changes, and
            incomplete features. The Command tab provides direct control over
            drone agent services and configuration. Use at your own risk.
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

        {/* Run it yourself */}
        <div className="text-center space-y-3">
          <h2 className="text-sm font-medium text-text-primary">
            Run it yourself
          </h2>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            The ADOS Drone Agent is open source (GPLv3). Clone the repo and run
            it on any Linux SBC.
          </p>
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

        {/* CTA */}
        <div className="text-center pt-4 pb-6 space-y-3">
          {hasApplied ? (
            <button
              disabled
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-text-tertiary bg-bg-tertiary border border-border-default rounded cursor-not-allowed"
            >
              <Clock size={14} />
              Application Pending
            </button>
          ) : (
            <button
              onClick={handleApply}
              disabled={applying || !convexAvailable}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-accent-primary rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {!isSignedIn && <LogIn size={14} />}
              {applying
                ? "Submitting..."
                : isSignedIn
                  ? "Apply for Alpha Access"
                  : "Sign In to Apply"}
            </button>
          )}
          {!convexAvailable && (
            <p className="text-[10px] text-text-tertiary">
              Alpha access requires a cloud connection.
            </p>
          )}
        </div>
      </div>

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
      />
    </div>
  );
}
