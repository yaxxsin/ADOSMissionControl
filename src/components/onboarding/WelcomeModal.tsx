/**
 * @module WelcomeModal
 * @description First-visit branded modal for jurisdiction, units, and demo mode selection.
 * Renders only when onboarded === false AND _hasHydrated === true. Cannot be dismissed
 * without completing — no close button, no Escape, no click-outside.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useGcsLocationStore, type GeoPermission } from "@/stores/gcs-location-store";
import { JURISDICTIONS, type Jurisdiction } from "@/lib/jurisdiction";
import { Select } from "@/components/ui/select";
import type { UnitSystem } from "@/stores/settings-store";

const JURISDICTION_OPTIONS: { value: Jurisdiction; label: string }[] = (
  Object.entries(JURISDICTIONS) as [Jurisdiction, (typeof JURISDICTIONS)[Jurisdiction]][]
).map(([key, cfg]) => ({
  value: key,
  label: `${cfg.flag}  ${cfg.name}`,
}));

export function WelcomeModal() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setJurisdiction = useSettingsStore((s) => s.setJurisdiction);
  const setUnits = useSettingsStore((s) => s.setUnits);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled);
  const setLocationEnabled = useSettingsStore((s) => s.setLocationEnabled);
  const requestPermission = useGcsLocationStore((s) => s.requestPermission);
  const isSupported = useGcsLocationStore((s) => s.isSupported);

  const [jurisdiction, setLocalJurisdiction] = useState<Jurisdiction | "">("");
  const [units, setLocalUnits] = useState<UnitSystem>("metric");
  const [demoMode, setLocalDemoMode] = useState(true);
  const [audioEnabled, setLocalAudioEnabled] = useState(false);
  const [locationEnabled, setLocalLocationEnabled] = useState(true);
  const [locationPermission, setLocationPermission] = useState<GeoPermission>("prompt");
  const [locationChecking, setLocationChecking] = useState(false);

  // Auto-request location permission on mount
  useEffect(() => {
    if (!isSupported) {
      setLocalLocationEnabled(false);
      return;
    }
    let cancelled = false;
    setLocationChecking(true);
    requestPermission().then((perm) => {
      if (cancelled) return;
      setLocationChecking(false);
      setLocationPermission(perm);
      if (perm === "granted") {
        setLocalLocationEnabled(true);
      } else {
        setLocalLocationEnabled(false);
      }
    });
    return () => { cancelled = true; };
  }, [isSupported, requestPermission]);

  // Auto-set units when jurisdiction changes
  useEffect(() => {
    if (jurisdiction) {
      const cfg = JURISDICTIONS[jurisdiction];
      setLocalUnits(cfg.defaultUnits);
    }
  }, [jurisdiction]);

  if (!hasHydrated || onboarded) return null;

  const handleLocationToggle = async () => {
    if (locationEnabled) {
      setLocalLocationEnabled(false);
      setLocationPermission("prompt");
      return;
    }
    setLocationChecking(true);
    const perm = await requestPermission();
    setLocationChecking(false);
    setLocationPermission(perm);
    if (perm === "granted") {
      setLocalLocationEnabled(true);
    }
  };

  const handleGetStarted = () => {
    if (jurisdiction) setJurisdiction(jurisdiction);
    setUnits(units);
    setDemoMode(demoMode);
    setAudioEnabled(audioEnabled);
    setLocationEnabled(locationEnabled);
    setOnboarded(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Welcome setup">
      <div className="bg-bg-secondary border border-border-default max-w-md w-full mx-4 p-8">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-accent-primary">
            ADOS
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium mt-0.5">
            Mission Control
          </p>
        </div>

        {/* Welcome text */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-display font-semibold text-text-primary">Welcome</h2>
          <p className="text-sm text-text-secondary mt-1">Set your preferences below, or just hit Get Started to use defaults.</p>
          <span className="inline-block mt-3 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-text-tertiary border border-border-default rounded-full">
            Open Beta
          </span>
          <p className="text-[10px] text-text-tertiary mt-2 flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Your data stays on this device. We don&apos;t collect or track anything.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Jurisdiction */}
          <div>
            <Select
              label="Regulatory Jurisdiction (optional)"
              value={jurisdiction}
              onChange={(v) => setLocalJurisdiction(v as Jurisdiction | "")}
              placeholder="Please select (optional)"
              options={JURISDICTION_OPTIONS}
            />
          </div>

          {/* Units */}
          <div>
            <Select
              label="Unit System"
              value={units}
              onChange={(v) => setLocalUnits(v as UnitSystem)}
              options={[
                { value: "metric", label: "Metric (m, km/h, °C)" },
                { value: "imperial", label: "Imperial (ft, mph, °F)" },
              ]}
            />
          </div>

          {/* Demo mode toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border-default">
            <div>
              <span className="text-sm text-text-primary">Enable Demo Mode</span>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Simulates drone telemetry for exploring the interface
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => setLocalDemoMode(!demoMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                demoMode ? "bg-accent-primary" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  demoMode ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Audio toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border-default">
            <div>
              <span className="text-sm text-text-primary">Enable Audio Alerts</span>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Plays sound alerts for battery, GPS, failsafe events
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={audioEnabled}
              onClick={() => setLocalAudioEnabled(!audioEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                audioEnabled ? "bg-accent-primary" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  audioEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Location toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border-default">
            <div>
              <span className="text-sm text-text-primary">Show My Position on Map</span>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Browser-local only. Displays your position on map views so you can see where you are relative to your drone. Never sent to any server.
              </p>
              {locationPermission === "granted" && locationEnabled && (
                <p className="text-[10px] text-status-success mt-0.5">Location access granted</p>
              )}
              {locationPermission === "denied" && (
                <p className="text-[10px] text-status-warning mt-0.5">
                  Permission denied — enable in browser settings or /config later
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={locationEnabled}
              disabled={locationChecking || !isSupported}
              onClick={handleLocationToggle}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                locationEnabled ? "bg-accent-primary" : "bg-bg-tertiary"
              } ${(locationChecking || !isSupported) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  locationEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleGetStarted}
          className="w-full mt-8 h-10 bg-accent-primary text-black text-sm font-semibold hover:brightness-110 transition-all"
        >
          Get Started
        </button>
        <a
          href="https://command.altnautica.com/community"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center mt-3 text-xs text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Join our Community
        </a>
      </div>
    </div>
  );
}
