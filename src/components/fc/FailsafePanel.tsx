"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDroneManager } from "@/stores/drone-manager";
import { ShieldAlert, Battery, Radio, Gauge, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface FailsafeParam {
  name: string;
  value: string;
  dirty: boolean;
}

type Params = Record<string, FailsafeParam>;

const DEFAULT_PARAMS: Params = {
  FS_SHORT_ACTN: { name: "FS_SHORT_ACTN", value: "0", dirty: false },
  FS_SHORT_TIMEOUT: { name: "FS_SHORT_TIMEOUT", value: "1.5", dirty: false },
  FS_LONG_ACTN: { name: "FS_LONG_ACTN", value: "0", dirty: false },
  FS_LONG_TIMEOUT: { name: "FS_LONG_TIMEOUT", value: "5.0", dirty: false },
  BATT_FS_VOLTSRC: { name: "BATT_FS_VOLTSRC", value: "0", dirty: false },
  BATT_FS_LOW_VOLT: { name: "BATT_FS_LOW_VOLT", value: "0", dirty: false },
  BATT_FS_LOW_ACT: { name: "BATT_FS_LOW_ACT", value: "0", dirty: false },
  FS_GCS_ENABL: { name: "FS_GCS_ENABL", value: "0", dirty: false },
  THR_FAILSAFE: { name: "THR_FAILSAFE", value: "0", dirty: false },
  THR_FS_VALUE: { name: "THR_FS_VALUE", value: "950", dirty: false },
};

export function FailsafePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const updateParam = useCallback((name: string, value: string) => {
    setParams((prev) => ({
      ...prev,
      [name]: { ...prev[name], value, dirty: true },
    }));
  }, []);

  const loadParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const names = Object.keys(DEFAULT_PARAMS);
    const updated = { ...params };
    for (const name of names) {
      try {
        const pv = await protocol.getParameter(name);
        updated[name] = { name, value: String(pv.value), dirty: false };
      } catch {
        // param not available on this firmware
      }
    }
    setParams(updated);
    setLoaded(true);
  }, [getSelectedProtocol, params]);

  const saveParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    setSaving(true);
    const dirty = Object.values(params).filter((p) => p.dirty);
    for (const p of dirty) {
      try {
        await protocol.setParameter(p.name, parseFloat(p.value));
        setParams((prev) => ({
          ...prev,
          [p.name]: { ...prev[p.name], dirty: false },
        }));
      } catch {
        // parameter write failed
      }
    }
    setSaving(false);
  }, [getSelectedProtocol, params]);

  const hasDirty = Object.values(params).some((p) => p.dirty);
  const connected = !!getSelectedProtocol();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Failsafe Configuration</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Configure failsafe actions for loss of control, battery, and GCS link
            </p>
          </div>
          {connected && !loaded && (
            <Button variant="secondary" size="sm" onClick={loadParams}>
              Load from FC
            </Button>
          )}
        </div>

        {/* Short Failsafe */}
        <Card icon={<ShieldAlert size={14} />} title="Short Failsafe" description="Triggered on brief signal loss">
          <Select
            label="FS_SHORT_ACTN — Action"
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Enabled (Circle)" },
            ]}
            value={params.FS_SHORT_ACTN.value}
            onChange={(v) => updateParam("FS_SHORT_ACTN", v)}
          />
          <Input
            label="FS_SHORT_TIMEOUT — Timeout (s)"
            type="number"
            step="0.1"
            min="0"
            unit="s"
            value={params.FS_SHORT_TIMEOUT.value}
            onChange={(e) => updateParam("FS_SHORT_TIMEOUT", e.target.value)}
          />
        </Card>

        {/* Long Failsafe */}
        <Card icon={<ShieldAlert size={14} />} title="Long Failsafe" description="Triggered on extended signal loss">
          <Select
            label="FS_LONG_ACTN — Action"
            options={[
              { value: "0", label: "0 — Continue" },
              { value: "1", label: "1 — RTL" },
              { value: "2", label: "2 — Glide" },
            ]}
            value={params.FS_LONG_ACTN.value}
            onChange={(v) => updateParam("FS_LONG_ACTN", v)}
          />
          <Input
            label="FS_LONG_TIMEOUT — Timeout (s)"
            type="number"
            step="0.1"
            min="0"
            unit="s"
            value={params.FS_LONG_TIMEOUT.value}
            onChange={(e) => updateParam("FS_LONG_TIMEOUT", e.target.value)}
          />
        </Card>

        {/* Battery Failsafe */}
        <Card icon={<Battery size={14} />} title="Battery Failsafe" description="Triggered on low battery voltage">
          <Select
            label="BATT_FS_VOLTSRC — Voltage Source"
            options={[
              { value: "0", label: "0 — Raw Voltage" },
              { value: "1", label: "1 — Sag Compensated" },
            ]}
            value={params.BATT_FS_VOLTSRC.value}
            onChange={(v) => updateParam("BATT_FS_VOLTSRC", v)}
          />
          <Input
            label="BATT_FS_LOW_VOLT — Low Voltage Threshold"
            type="number"
            step="0.1"
            min="0"
            unit="V"
            value={params.BATT_FS_LOW_VOLT.value}
            onChange={(e) => updateParam("BATT_FS_LOW_VOLT", e.target.value)}
          />
          <Select
            label="BATT_FS_LOW_ACT — Low Voltage Action"
            options={[
              { value: "0", label: "0 — None" },
              { value: "1", label: "1 — Land" },
              { value: "2", label: "2 — RTL" },
              { value: "3", label: "3 — SmartRTL or RTL" },
            ]}
            value={params.BATT_FS_LOW_ACT.value}
            onChange={(v) => updateParam("BATT_FS_LOW_ACT", v)}
          />
        </Card>

        {/* GCS Failsafe */}
        <Card icon={<Radio size={14} />} title="GCS Failsafe" description="Triggered on GCS link loss">
          <Select
            label="FS_GCS_ENABL — GCS Failsafe"
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Enabled (RTL)" },
              { value: "2", label: "2 — Enabled (continue in auto)" },
            ]}
            value={params.FS_GCS_ENABL.value}
            onChange={(v) => updateParam("FS_GCS_ENABL", v)}
          />
        </Card>

        {/* Throttle Failsafe */}
        <Card icon={<Gauge size={14} />} title="Throttle Failsafe" description="Triggered on RC throttle loss">
          <Select
            label="THR_FAILSAFE — Throttle Failsafe"
            options={[
              { value: "0", label: "0 — Disabled" },
              { value: "1", label: "1 — Enabled" },
            ]}
            value={params.THR_FAILSAFE.value}
            onChange={(v) => updateParam("THR_FAILSAFE", v)}
          />
          <Input
            label="THR_FS_VALUE — Throttle PWM value"
            type="number"
            step="1"
            min="800"
            max="1200"
            unit="μs"
            value={params.THR_FS_VALUE.value}
            onChange={(e) => updateParam("THR_FS_VALUE", e.target.value)}
          />
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={saveParams}
          >
            Save to Flight Controller
          </Button>
          {!connected && (
            <span className="text-[10px] text-text-tertiary">Connect a drone to save parameters</span>
          )}
          {hasDirty && connected && (
            <span className="text-[10px] text-status-warning">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent-primary">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
