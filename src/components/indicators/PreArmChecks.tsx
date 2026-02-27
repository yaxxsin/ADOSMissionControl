"use client";

import { useState, useEffect, useRef } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useSensorHealthStore } from "@/stores/sensor-health-store";
import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreArmMessage {
  text: string;
  suggestion: string;
}

/** Common pre-arm failure messages and their fix suggestions. */
const FIX_DATABASE: Record<string, string> = {
  "compass not calibrated": "Go to Calibration tab and run Compass calibration",
  "accelerometers not calibrated": "Go to Calibration tab and run Accelerometer calibration",
  "barometer not healthy": "Check barometer sensor connection",
  "gps not found": "Check GPS module connection and wiring",
  "radio failsafe": "Check RC transmitter is on and bound",
  "battery failsafe": "Check battery voltage or adjust BATT_LOW_VOLT",
  "logging not started": "Insert SD card or check LOG_BACKEND_TYPE",
  "fence requires position": "Wait for GPS 3D fix before enabling geofence",
  "check firmware": "Firmware may need updating",
  "gyros not calibrated": "Keep vehicle still and run Gyro calibration",
  "need 3d fix": "Wait for GPS to acquire 3D fix",
  "bad velocity": "Wait for EKF to settle",
  "high magnetic interference": "Move vehicle away from metal objects",
  "check board voltage": "Check power supply voltage",
  "hardware safety switch": "Press safety switch on vehicle",
  "on disabled channel": "A servo function is assigned to a channel with no PWM output. Go to Configure → Outputs and either move the function to an enabled channel (1-8) or increase BRD_PWM_COUNT in Parameters.",
};

function findSuggestion(text: string): string {
  const lower = text.toLowerCase();
  for (const [pattern, suggestion] of Object.entries(FIX_DATABASE)) {
    if (lower.includes(pattern)) return suggestion;
  }
  return "Check vehicle hardware and configuration";
}

/**
 * Pre-arm check checklist with pass/fail status and fix suggestions.
 * Captures STATUSTEXT messages with "PreArm:" prefix.
 */
export function PreArmChecks({ className }: { className?: string }) {
  const protocol = useDroneManager.getState().getSelectedProtocol();
  const healthyCount = useSensorHealthStore((s) => s.getHealthySensorCount());
  const totalPresent = useSensorHealthStore((s) => s.getTotalPresentCount());
  const [failures, setFailures] = useState<PreArmMessage[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to STATUSTEXT for PreArm messages
  useEffect(() => {
    if (!protocol) return;

    const unsub = protocol.onStatusText?.((data) => {
      if (data.text.startsWith("PreArm:") || data.text.startsWith("Arm:")) {
        const cleanText = data.text.replace(/^(PreArm:|Arm:)\s*/, "");
        setFailures((prev) => {
          // Deduplicate
          if (prev.some((f) => f.text === cleanText)) return prev;
          return [...prev, { text: cleanText, suggestion: findSuggestion(cleanText) }];
        });
      }
    });
    unsubRef.current = unsub;

    return () => {
      unsub?.();
    };
  }, [protocol]);

  async function runCheck() {
    if (!protocol) return;
    setChecking(true);
    setFailures([]);
    await protocol.doPreArmCheck();
    // Wait a bit for STATUSTEXT messages to arrive
    setTimeout(() => {
      setChecking(false);
      setLastChecked(Date.now());
    }, 3000);
  }

  const allClear = failures.length === 0 && lastChecked !== null && !checking;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with check button */}
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
          Pre-Arm Checks
        </h3>
        <span className="text-[10px] text-text-tertiary font-mono">
          Sensors: {healthyCount}/{totalPresent}
        </span>
        <Button size="sm" onClick={runCheck} disabled={checking || !protocol}>
          <RefreshCw size={10} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking..." : "Run Check"}
        </Button>
      </div>

      {/* Results */}
      {checking && (
        <div className="text-[10px] text-text-tertiary animate-pulse">
          Running pre-arm checks...
        </div>
      )}

      {allClear && (
        <div className="flex items-center gap-1.5 text-status-success text-xs">
          <Check size={14} />
          <span>All pre-arm checks passed</span>
        </div>
      )}

      {failures.length > 0 && (
        <div className="space-y-1">
          {failures.map((failure, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px]">
              <X size={12} className="text-status-error shrink-0 mt-0.5" />
              <div>
                <span className="text-text-primary font-medium">{failure.text}</span>
                <p className="text-text-tertiary text-[10px]">
                  <AlertTriangle size={9} className="inline mr-0.5" />
                  {failure.suggestion}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!lastChecked && !checking && (
        <div className="text-[10px] text-text-tertiary">
          Click &quot;Run Check&quot; to verify pre-arm status
        </div>
      )}
    </div>
  );
}
