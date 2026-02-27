"use client";

import { useState, useEffect, useCallback } from "react";
import { useSensorHealthStore } from "@/stores/sensor-health-store";
import { SensorHealthGrid } from "@/components/indicators/SensorHealthGrid";
import { EkfStatusBars } from "@/components/indicators/EkfStatusBars";
import { VibrationGauges } from "@/components/indicators/VibrationGauges";
import { GpsSkyView } from "@/components/indicators/GpsSkyView";
import { PreArmChecks } from "@/components/indicators/PreArmChecks";
import { Button } from "@/components/ui/button";
import { useDroneManager } from "@/stores/drone-manager";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Component ────────────────────────────────────────────────

export function PreArmPanel() {
  const healthyCount = useSensorHealthStore((s) => s.getHealthySensorCount());
  const totalPresent = useSensorHealthStore((s) => s.getTotalPresentCount());
  const protocol = useDroneManager.getState().getSelectedProtocol();

  const [showAllSensors, setShowAllSensors] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh sensor data every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshAll = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Health Check</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Sensor status, EKF, vibration, GPS, and pre-arm checks
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={handleRefreshAll}>
            Refresh
          </Button>
        </div>

        {/* Sensor Status */}
        <Section icon={<Activity size={14} />} title="Sensor Status" subtitle={`${healthyCount}/${totalPresent} sensors healthy`}>
          <SensorHealthGrid showAll={showAllSensors} />
          <button
            onClick={() => setShowAllSensors(!showAllSensors)}
            className="text-[10px] text-accent-primary hover:underline mt-1"
          >
            {showAllSensors ? "Show present only" : "Show all 32 sensor bits"}
          </button>
        </Section>

        {/* EKF Status */}
        <Section icon={<Activity size={14} />} title="EKF Status" subtitle="Extended Kalman Filter variance">
          <EkfStatusBars />
        </Section>

        {/* Vibration */}
        <Section icon={<Activity size={14} />} title="Vibration" subtitle="Accelerometer vibration levels (m/s/s)">
          <VibrationGauges />
        </Section>

        {/* GPS */}
        <Section icon={<Activity size={14} />} title="GPS" subtitle="Position fix and satellite info">
          <GpsSkyView />
        </Section>

        {/* Pre-Arm Checks */}
        <Section icon={<ShieldCheck size={14} />} title="Pre-Arm Checks" subtitle="Flight readiness verification">
          <PreArmChecks />
        </Section>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent-primary">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
