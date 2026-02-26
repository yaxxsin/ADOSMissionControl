"use client";

import { useState } from "react";
import { Settings, AlertTriangle, LogOut, CloudOff } from "lucide-react";
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
import { SignInModal } from "@/components/auth/SignInModal";
import { ConnectDialog } from "@/components/connect/ConnectDialog";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { formatSyncTime } from "@/lib/sync";
import { useAutoReconnect } from "@/hooks/use-auto-reconnect";
import { useGcsLocation } from "@/hooks/use-gcs-location";
import Link from "next/link";

export function CommandShell({ children }: { children: React.ReactNode }) {
  useAutoReconnect();
  useGcsLocation();
  const demo = useSettingsStore((s) => s.demoMode);
  const alertCount = useFleetStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const mavConnected = useDroneManager((s) => s.selectedDroneId !== null);
  const videoStreaming = useVideoStore((s) => s.isStreaming);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const authSignOut = useAuthStore((s) => s.signOut);
  const [signInOpen, setSignInOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="flex flex-col h-dvh">
      {/* Welcome onboarding modal */}
      <WelcomeModal />

      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-bg-secondary border-b border-border-default shrink-0">
        {/* Left — Wordmark */}
        <div className="flex items-baseline gap-1.5">
          <span className="font-display uppercase tracking-[0.25em] text-sm font-semibold text-accent-primary">
            ADOS
          </span>
          <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">
            Mission Control
          </span>
          {demo && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-status-warning/20 text-status-warning">
              Demo
            </span>
          )}
        </div>

        {/* Center — Navigation */}
        <CommandNav />

        {/* Right — Status indicators */}
        <div className="flex items-center gap-3">
          {/* Connection dots: MAVLink / Video / MQTT */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${mavConnected ? "bg-status-success" : "bg-text-tertiary"}`} title="MAVLink" />
            <span className={`w-2 h-2 rounded-full ${videoStreaming ? "bg-status-success" : "bg-text-tertiary"}`} title="Video" />
            <span className="w-2 h-2 rounded-full bg-text-tertiary" title="MQTT" />

            {/* Sync status dot — only when signed in */}
            {isAuthenticated && (
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === "synced" ? "bg-status-success" :
                  syncStatus === "syncing" ? "bg-status-warning animate-pulse" :
                  syncStatus === "error" ? "bg-status-error" :
                  "bg-text-tertiary"
                }`}
                title={`Sync: ${syncStatus}${lastSyncedAt ? ` (${formatSyncTime(lastSyncedAt)})` : ""}`}
              />
            )}
          </div>

          {/* Alert count */}
          {alertCount > 0 && (
            <div className="flex items-center gap-1 text-status-warning">
              <AlertTriangle size={12} />
              <span className="text-xs font-mono tabular-nums">{alertCount}</span>
            </div>
          )}

          {/* Auth — sign in or user menu */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-[10px] font-semibold uppercase"
                title={user?.email}
              >
                {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </button>
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
                    onClick={() => { authSignOut(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    <LogOut size={12} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSignInOpen(true)}
              className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <CloudOff size={10} />
              <span className="hidden sm:inline">Local only</span>
            </button>
          )}

          {/* Cmd+K hint */}
          <kbd className="text-[10px] text-text-tertiary border border-border-default px-1 py-0.5 font-mono hidden sm:inline">
            ⌘K
          </kbd>

          {/* Settings */}
          <Link
            href="/config"
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>
        </div>
      </header>

      {/* Local storage warning banner */}
      <LocalStorageBanner onSignIn={() => setSignInOpen(true)} />

      {/* Sign-in modal */}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Connect dialog */}
      <ConnectDialog />

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
