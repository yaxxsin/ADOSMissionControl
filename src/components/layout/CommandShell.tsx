"use client";

import { useState, useEffect } from "react";
import { Settings, AlertTriangle, LogOut, CloudOff, Zap, Minimize2, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { CommandNav } from "./CommandNav";
import { DemoProvider } from "./DemoProvider";
import { CommandPalette } from "@/components/shared/command-palette";
import { FailsafeAlertBanner } from "@/components/flight/FailsafeAlertBanner";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneStore } from "@/stores/drone-store";
import { useVideoStore } from "@/stores/video-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { LocalStorageBanner } from "@/components/ui/local-storage-banner";
import { useUiStore } from "@/stores/ui-store";
import { SignInModal } from "@/components/auth/SignInModal";
import { ConnectDialog } from "@/components/connect/ConnectDialog";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { formatSyncTime } from "@/lib/sync";
import { useAutoReconnect } from "@/hooks/use-auto-reconnect";
import { useGcsLocation } from "@/hooks/use-gcs-location";
import { usePlatform } from "@/hooks/use-platform";
import { useDisconnectGuard } from "@/hooks/use-disconnect-guard";
import { DisconnectGuard } from "@/components/fc/DisconnectGuard";
import { cn } from "@/lib/utils";
import { ChangelogNotificationGate } from "@/components/changelog/ChangelogNotificationGate";
import { ChangelogBadge } from "@/components/changelog/ChangelogBadge";
import { ConnectionQualityMeter } from "@/components/indicators/ConnectionQualityMeter";
import { RecordingControls } from "@/components/shared/RecordingControls";
import Link from "next/link";

export function CommandShell({ children }: { children: React.ReactNode }) {
  useAutoReconnect();
  useGcsLocation();
  const { isElectron, isMac, isWindows, isLinux } = usePlatform();
  const {
    guardOpen,
    commitAndDisconnect,
    discardAndDisconnect,
    cancelDisconnect,
    requestDisconnect,
  } = useDisconnectGuard();

  // Listen for disconnect requests from other components (e.g. ActiveConnections)
  useEffect(() => {
    const handler = (e: Event) => {
      const droneId = (e as CustomEvent<string>).detail;
      if (droneId) requestDisconnect(droneId);
    };
    window.addEventListener("request-disconnect", handler);
    return () => window.removeEventListener("request-disconnect", handler);
  }, [requestDisconnect]);
  const demo = useSettingsStore((s) => s.demoMode);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const alertCount = useFleetStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const mavConnected = useDroneManager((s) => s.selectedDroneId !== null);
  const videoStreaming = useVideoStore((s) => s.isStreaming);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const authSignOut = useAuthStore((s) => s.signOut);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const exitImmersiveMode = useUiStore((s) => s.exitImmersiveMode);
  const [signInOpen, setSignInOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Listen for sign-in requests from AuthGate and other components
  useEffect(() => {
    const handler = () => setSignInOpen(true);
    window.addEventListener("open-signin", handler);
    return () => window.removeEventListener("open-signin", handler);
  }, []);

  // Escape key exits immersive mode
  useEffect(() => {
    if (!immersiveMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitImmersiveMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [immersiveMode, exitImmersiveMode]);

  return (
    <div className="flex flex-col h-dvh">
      {/* Welcome onboarding modal */}
      <WelcomeModal />

      {/* Changelog "What's New" notification modal */}
      <ChangelogNotificationGate />

      {/* Immersive mode exit button */}
      {immersiveMode && (
        <button
          onClick={exitImmersiveMode}
          className="fixed top-3 right-3 z-50 p-1.5 bg-bg-secondary/80 border border-border-default text-text-tertiary hover:text-text-primary transition-colors backdrop-blur-sm"
          title="Exit immersive mode (Esc)"
        >
          <Minimize2 size={14} />
        </button>
      )}

      {/* Top bar */}
      {!immersiveMode && <header className={cn(
        "h-12 flex items-center justify-between px-4 bg-bg-secondary border-b border-border-default shrink-0",
        isElectron && isMac && "pl-[76px]",
        isElectron && isWindows && "pr-[140px]",
        isElectron && !isLinux && "[-webkit-app-region:drag]"
      )}>
        {/* Left — Wordmark */}
        <div className={cn("flex items-baseline gap-1.5", isElectron && !isLinux && "[-webkit-app-region:no-drag]")}>
          <span className="font-display uppercase tracking-[0.25em] text-sm font-semibold text-accent-primary">
            ADOS
          </span>
          <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">
            Mission Control
          </span>
          {demo && (
            <Tooltip content="Exit demo mode" position="bottom">
              <button
                onClick={() => setDemoMode(false)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-status-warning/20 text-status-warning hover:bg-status-warning/30 transition-colors"
              >
                Demo
                <X size={10} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Center — Navigation */}
        <div className={cn(isElectron && !isLinux && "[-webkit-app-region:no-drag]")}>
          <CommandNav />
        </div>

        {/* Right — Status indicators */}
        <div className={cn("flex items-center gap-3", isElectron && !isLinux && "[-webkit-app-region:no-drag]")}>
          {/* Connection dots: MAVLink / Video / MQTT */}
          <Tooltip content="Connection status" position="bottom">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${mavConnected ? "bg-status-success" : "bg-text-tertiary"}`} />
              <span className={`w-2 h-2 rounded-full ${videoStreaming ? "bg-status-success" : "bg-text-tertiary"}`} />
              <span className="w-2 h-2 rounded-full bg-text-tertiary" />

              {/* Sync status dot — only when signed in */}
              {isAuthenticated && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === "synced" ? "bg-status-success" :
                    syncStatus === "syncing" ? "bg-status-warning animate-pulse" :
                    syncStatus === "error" ? "bg-status-error" :
                    "bg-text-tertiary"
                  }`}
                />
              )}
            </div>
          </Tooltip>

          {/* Connection quality meter — only when a drone is connected */}
          {mavConnected && <ConnectionQualityMeter />}

          {/* Telemetry recording controls — only when a drone is connected */}
          {mavConnected && <RecordingControls />}

          {/* Alert count */}
          {alertCount > 0 && (
            <Tooltip content="Unacknowledged alerts" position="bottom">
              <div className="flex items-center gap-1 text-status-warning">
                <AlertTriangle size={12} />
                <span className="text-xs font-mono tabular-nums">{alertCount}</span>
              </div>
            </Tooltip>
          )}

          {/* Auth — sign in or user menu */}
          {isAuthenticated ? (
            <div className="relative">
              <Tooltip content={user?.email || "Account"} position="bottom">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-[10px] font-semibold uppercase"
                >
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </button>
              </Tooltip>
              {userMenuOpen && (
                <div className="absolute right-0 top-8 bg-bg-secondary border border-border-default shadow-lg z-50 w-48 py-1">
                  <div className="px-3 py-2 border-b border-border-default">
                    <p className="text-xs text-text-primary font-medium truncate">{user?.name || user?.email}</p>
                    <p className="text-[10px] text-text-tertiary truncate">{user?.email}</p>
                    {lastSyncedAt && (
                      <p className="text-[10px] text-text-tertiary mt-1">
                        Last synced: {formatSyncTime(lastSyncedAt)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      // Clear server-side auth cookies
                      fetch("/api/auth", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "auth:signOut", args: {} }),
                      }).catch(() => {});
                      // Clear client-side Zustand state
                      authSignOut();
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    <LogOut size={12} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Tooltip content="Sign in for cloud sync" position="bottom">
              <button
                onClick={() => setSignInOpen(true)}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <CloudOff size={10} />
                <span className="hidden sm:inline">Local only</span>
              </button>
            </Tooltip>
          )}

          {/* Cmd+K hint */}
          <Tooltip content="Command palette" position="bottom">
            <kbd className="text-[10px] text-text-tertiary border border-border-default px-1 py-0.5 font-mono hidden sm:inline">
              ⌘K
            </kbd>
          </Tooltip>

          {/* Community */}
          <ChangelogBadge />

          {/* Flash Tool */}
          <Tooltip content="Flash Tool" position="bottom">
            <Link
              href="/config/firmware"
              className="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Flash Tool"
            >
              <Zap size={16} />
            </Link>
          </Tooltip>

          {/* Settings */}
          <Tooltip content="Settings" position="bottom">
            <Link
              href="/config"
              className="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Settings"
            >
              <Settings size={16} />
            </Link>
          </Tooltip>
        </div>
      </header>}

      {/* Local storage warning banner */}
      {!immersiveMode && <LocalStorageBanner onSignIn={() => setSignInOpen(true)} />}

      {/* Sign-in modal */}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Connect dialog */}
      <ConnectDialog />

      {/* Disconnect guard — warns about uncommitted param writes */}
      <DisconnectGuard
        open={guardOpen}
        onCommitAndDisconnect={commitAndDisconnect}
        onDiscardAndDisconnect={discardAndDisconnect}
        onCancel={cancelDisconnect}
      />

      {/* Body */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <DemoProvider />
        <CommandPalette />
        <FailsafeAlertBanner />
        {children}
      </main>
    </div>
  );
}
