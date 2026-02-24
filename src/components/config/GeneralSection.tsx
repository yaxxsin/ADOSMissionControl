"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useSettingsStore } from "@/stores/settings-store";
import { JURISDICTIONS, type Jurisdiction } from "@/lib/jurisdiction";

export function GeneralSection() {
  const jurisdiction = useSettingsStore((s) => s.jurisdiction);
  const units = useSettingsStore((s) => s.units);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const autoReconnect = useSettingsStore((s) => s.autoReconnect);
  const autoConnectOnLoad = useSettingsStore((s) => s.autoConnectOnLoad);
  const setJurisdiction = useSettingsStore((s) => s.setJurisdiction);
  const setUnits = useSettingsStore((s) => s.setUnits);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const setAutoReconnect = useSettingsStore((s) => s.setAutoReconnect);
  const setAutoConnectOnLoad = useSettingsStore((s) => s.setAutoConnectOnLoad);

  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("IST");
  const [telemetryRate, setTelemetryRate] = useState("10");

  const handleJurisdictionChange = (value: string) => {
    const j = value as Jurisdiction;
    setJurisdiction(j);
    setUnits(JURISDICTIONS[j].defaultUnits);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">General Settings</h2>

      <Card>
        <div className="space-y-4">
          <Select
            label="Regulatory Jurisdiction"
            value={jurisdiction}
            onChange={handleJurisdictionChange}
            options={[
              { value: "dgca", label: `${JURISDICTIONS.dgca.flag}  DGCA — India` },
              { value: "faa", label: `${JURISDICTIONS.faa.flag}  FAA — United States` },
              { value: "casa", label: `${JURISDICTIONS.casa.flag}  CASA — Australia` },
            ]}
          />

          <Select
            label="Units"
            value={units}
            onChange={(v) => setUnits(v as "metric" | "imperial")}
            options={[
              { value: "metric", label: "Metric (m, km/h, \u00b0C)" },
              { value: "imperial", label: "Imperial (ft, mph, \u00b0F)" },
            ]}
          />

          <Select
            label="Language"
            value={language}
            onChange={setLanguage}
            options={[
              { value: "en", label: "English" },
              { value: "hi", label: "Hindi" },
            ]}
          />

          <Select
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={[
              { value: "IST", label: "IST (UTC+5:30)" },
              { value: "UTC", label: "UTC (UTC+0:00)" },
              { value: "PST", label: "PST (UTC-8:00)" },
            ]}
          />

          <Toggle
            label="Auto-connect on startup"
            checked={autoConnectOnLoad}
            onChange={setAutoConnectOnLoad}
          />

          <Toggle
            label="Auto-reconnect on disconnect"
            checked={autoReconnect}
            onChange={setAutoReconnect}
          />

          <Select
            label="Telemetry rate"
            value={telemetryRate}
            onChange={setTelemetryRate}
            options={[
              { value: "1", label: "1 Hz" },
              { value: "5", label: "5 Hz" },
              { value: "10", label: "10 Hz" },
              { value: "20", label: "20 Hz" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-1">
          <Toggle
            label="Demo Mode"
            checked={demoMode}
            onChange={setDemoMode}
          />
          <p className="text-[10px] text-text-tertiary pl-0.5">
            Simulates drone telemetry for exploring the interface without a connected flight controller.
          </p>
        </div>
      </Card>
    </div>
  );
}
