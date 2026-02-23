"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useDroneManager } from "@/stores/drone-manager";
import {
  Save,
  RotateCcw,
  AlertTriangle,
  Usb,
} from "lucide-react";
import type { ParameterValue } from "@/lib/protocol/types";

/** Serial port protocol options (SERIAL_PROTOCOL values). */
const PROTOCOL_OPTIONS = [
  { value: "-1", label: "None" },
  { value: "1", label: "MAVLink1" },
  { value: "2", label: "MAVLink2" },
  { value: "4", label: "FrSky D" },
  { value: "5", label: "GPS" },
  { value: "7", label: "Alexmos Gimbal" },
  { value: "10", label: "FrSky PassThrough" },
  { value: "12", label: "CompassLearn" },
  { value: "13", label: "SToRM32 Gimbal" },
  { value: "14", label: "Rangefinder" },
  { value: "19", label: "ESC Telemetry" },
  { value: "20", label: "RunCam" },
  { value: "21", label: "CRSF (Crossfire)" },
  { value: "23", label: "RC Input" },
  { value: "28", label: "DDS / ROS2" },
];

/** Baud rate options (SERIAL_BAUD values). */
const BAUD_OPTIONS = [
  { value: "1", label: "1200" },
  { value: "2", label: "2400" },
  { value: "4", label: "4800" },
  { value: "9", label: "9600" },
  { value: "19", label: "19200" },
  { value: "38", label: "38400" },
  { value: "57", label: "57600" },
  { value: "111", label: "111100" },
  { value: "115", label: "115200" },
  { value: "230", label: "230400" },
  { value: "460", label: "460800" },
  { value: "500", label: "500000" },
  { value: "921", label: "921600" },
  { value: "1500", label: "1500000" },
];

const NUM_PORTS = 8;

interface PortConfig {
  protocol: string;
  baud: string;
}

export function PortsPanel() {
  const [ports, setPorts] = useState<PortConfig[]>(
    Array.from({ length: NUM_PORTS }, () => ({ protocol: "-1", baud: "57" }))
  );
  const [original, setOriginal] = useState<PortConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load serial params on mount
  useEffect(() => {
    loadPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPorts = useCallback(async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) {
      setError("No drone connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = await protocol.getAllParameters();
      const paramMap = new Map<string, number>();
      for (const p of params) {
        paramMap.set(p.name, p.value);
      }

      const loaded: PortConfig[] = [];
      for (let i = 0; i < NUM_PORTS; i++) {
        loaded.push({
          protocol: String(paramMap.get(`SERIAL${i}_PROTOCOL`) ?? -1),
          baud: String(paramMap.get(`SERIAL${i}_BAUD`) ?? 57),
        });
      }
      setPorts(loaded);
      setOriginal(loaded.map((p) => ({ ...p })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read serial parameters");
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePort = useCallback((index: number, field: keyof PortConfig, value: string) => {
    setPorts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const hasChanges = useMemo(() => {
    if (original.length === 0) return false;
    return ports.some(
      (p, i) => p.protocol !== original[i].protocol || p.baud !== original[i].baud
    );
  }, [ports, original]);

  const handleSave = useCallback(async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) return;

    setSaving(true);
    setError(null);
    const failures: string[] = [];

    for (let i = 0; i < NUM_PORTS; i++) {
      if (ports[i].protocol !== original[i].protocol) {
        try {
          const result = await protocol.setParameter(
            `SERIAL${i}_PROTOCOL`,
            parseInt(ports[i].protocol, 10)
          );
          if (!result.success) failures.push(`SERIAL${i}_PROTOCOL: ${result.message}`);
        } catch {
          failures.push(`SERIAL${i}_PROTOCOL: write failed`);
        }
      }
      if (ports[i].baud !== original[i].baud) {
        try {
          const result = await protocol.setParameter(
            `SERIAL${i}_BAUD`,
            parseInt(ports[i].baud, 10)
          );
          if (!result.success) failures.push(`SERIAL${i}_BAUD: ${result.message}`);
        } catch {
          failures.push(`SERIAL${i}_BAUD: write failed`);
        }
      }
    }

    if (failures.length > 0) {
      setError(`Failed: ${failures.join(", ")}`);
    } else {
      setOriginal(ports.map((p) => ({ ...p })));
    }
    setSaving(false);
  }, [ports, original]);

  const handleRevert = useCallback(() => {
    if (original.length > 0) {
      setPorts(original.map((p) => ({ ...p })));
    }
  }, [original]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-default bg-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Usb size={16} className="text-text-secondary" />
          <h1 className="text-sm font-display font-semibold text-text-primary">
            Serial Ports
          </h1>
          {hasChanges && (
            <Badge variant="warning" size="sm">Unsaved changes</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={12} />}
            onClick={handleRevert}
            disabled={!hasChanges}
          >
            Revert
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={12} />}
            onClick={handleSave}
            disabled={!hasChanges}
            loading={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-status-error/10 border-b border-status-error/30 flex items-center gap-2">
          <AlertTriangle size={14} className="text-status-error flex-shrink-0" />
          <span className="text-xs text-status-error">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs text-status-error hover:text-status-error/80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Port table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-xs text-text-tertiary">Loading serial parameters...</span>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[60px_1fr_1fr] gap-3 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Port
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Protocol
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Baud Rate
                </span>
              </div>

              {ports.map((port, i) => {
                const protocolChanged = original.length > 0 && port.protocol !== original[i].protocol;
                const baudChanged = original.length > 0 && port.baud !== original[i].baud;
                const rowChanged = protocolChanged || baudChanged;

                return (
                  <Card key={i} className={rowChanged ? "border-status-warning/40" : undefined}>
                    <div className="grid grid-cols-[60px_1fr_1fr] gap-3 items-center">
                      <span className="text-xs font-mono text-text-secondary">
                        SERIAL{i}
                      </span>
                      <Select
                        options={PROTOCOL_OPTIONS}
                        value={port.protocol}
                        onChange={(v) => updatePort(i, "protocol", v)}
                        className={protocolChanged ? "border-status-warning/60" : undefined}
                      />
                      <Select
                        options={BAUD_OPTIONS}
                        value={port.baud}
                        onChange={(v) => updatePort(i, "baud", v)}
                        className={baudChanged ? "border-status-warning/60" : undefined}
                      />
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
