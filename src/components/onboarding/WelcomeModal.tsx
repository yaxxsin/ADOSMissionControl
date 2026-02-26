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
import type { UnitSystem } from "@/stores/settings-store";

const JURISDICTION_OPTIONS: { value: Jurisdiction; label: string }[] = [
  { value: "dgca", label: `${JURISDICTIONS.dgca.flag}  DGCA — India` },
  { value: "faa", label: `${JURISDICTIONS.faa.flag}  FAA — United States` },
  { value: "casa", label: `${JURISDICTIONS.casa.flag}  CASA — Australia` },
];

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

  const [jurisdiction, setLocalJurisdiction] = useState<Jurisdiction>("dgca");
  const [units, setLocalUnits] = useState<UnitSystem>("metric");
  const [demoMode, setLocalDemoMode] = useState(true);
  const [audioEnabled, setLocalAudioEnabled] = useState(false);
  const [locationEnabled, setLocalLocationEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<GeoPermission>("prompt");
  const [locationChecking, setLocationChecking] = useState(false);

  // Auto-set units when jurisdiction changes
  useEffect(() => {
    const cfg = JURISDICTIONS[jurisdiction];
    setLocalUnits(cfg.defaultUnits);
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
    setJurisdiction(jurisdiction);
    setUnits(units);
    setDemoMode(demoMode);
    setAudioEnabled(audioEnabled);
    setLocationEnabled(locationEnabled);
    setOnboarded(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
          <p className="text-sm text-text-secondary mt-1">Configure your environment</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Jurisdiction */}
          <div>
            <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">
              Regulatory Jurisdiction
            </label>
            <select
              value={jurisdiction}
              onChange={(e) => setLocalJurisdiction(e.target.value as Jurisdiction)}
              className="w-full h-9 bg-bg-primary border border-border-default text-text-primary text-sm px-3 focus:outline-none focus:border-accent-primary"
            >
              {JURISDICTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Units */}
          <div>
            <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">
              Unit System
            </label>
            <select
              value={units}
              onChange={(e) => setLocalUnits(e.target.value as UnitSystem)}
              className="w-full h-9 bg-bg-primary border border-border-default text-text-primary text-sm px-3 focus:outline-none focus:border-accent-primary"
            >
              <option value="metric">Metric (m, km/h, °C)</option>
              <option value="imperial">Imperial (ft, mph, °F)</option>
            </select>
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
              <span className="text-sm text-text-primary">Share GCS Location</span>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Shows your position on all map views
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
      </div>
    </div>
  );
}
