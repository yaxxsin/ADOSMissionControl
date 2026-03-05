"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import { useDroneManager } from "@/stores/drone-manager";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getMotorLayout,
  getUniqueTypesForClass,
  formatMotorCount,
  FRAME_CLASS_NAMES,
  FRAME_CLASS_DESCRIPTIONS,
  FRAME_CLASS_NOTES,
  FRAME_TYPE_DESCRIPTIONS,
} from "@/lib/motor-layouts";
import { Select } from "@/components/ui/select";
import { Save, HardDrive, Box, Zap, Info, Trash2 } from "lucide-react";

// ── Lazy-loaded 3D component ────────────────────────────────

const MotorDiagram3D = dynamic(
  () => import("./MotorDiagram3D").then((m) => ({ default: m.MotorDiagram3D })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] flex items-center justify-center text-xs text-text-tertiary bg-bg-tertiary animate-pulse">
        Loading 3D view...
      </div>
    ),
  },
);

// ── Constants ────────────────────────────────────────────────

const COPTER_FRAME_PARAMS = ["FRAME_CLASS", "FRAME_TYPE"];
const PLANE_FRAME_PARAMS = ["Q_FRAME_CLASS", "Q_FRAME_TYPE"];

const FRAME_CLASS_OPTIONS = Object.entries(FRAME_CLASS_NAMES).map(([value, label]) => ({
  value: String(Number(value)),
  label: `${Number(value)} — ${label}`,
  description: FRAME_CLASS_DESCRIPTIONS[Number(value)],
}));

// ── Config Log Types ─────────────────────────────────────────

interface ConfigLogEntry {
  id: number;
  timestamp: number;
  type: "read" | "write" | "flash" | "error" | "info";
  message: string;
}

const LOG_TYPE_COLORS: Record<ConfigLogEntry["type"], string> = {
  read: "text-accent-primary",
  write: "text-accent-secondary",
  flash: "text-status-success",
  error: "text-status-error",
  info: "text-text-tertiary",
};

// ── Component ────────────────────────────────────────────────

export function FramePanel() {
  const { toast } = useToast();
  const { isLocked } = useArmedLock();
  const { firmwareType } = useFirmwareCapabilities();

  // Derive connected state from protocol (like other panels)
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  // Firmware-aware parameter names
  const isPlane = firmwareType === "ardupilot-plane";
  const isCopter = firmwareType === "ardupilot-copter";
  const isRover = firmwareType === "ardupilot-rover";
  const isSub = firmwareType === "ardupilot-sub";

  const paramNames = useMemo(() => {
    if (isPlane) return PLANE_FRAME_PARAMS;
    return COPTER_FRAME_PARAMS;
  }, [isPlane]);

  // On plane, QuadPlane params are optional (not all planes have VTOL motors).
  // On unknown firmware, params are optional too — fail silently.
  const optionalParams = useMemo(() => {
    if (isPlane || (!isCopter && !isRover && !isSub)) return paramNames;
    return [];
  }, [isPlane, isCopter, isRover, isSub, paramNames]);

  // Config log state
  const [logEntries, setLogEntries] = useState<ConfigLogEntry[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLogEntry = useCallback((event: { type: string; message: string }) => {
    const entry: ConfigLogEntry = {
      id: ++logIdRef.current,
      timestamp: Date.now(),
      type: event.type as ConfigLogEntry["type"],
      message: event.message,
    };
    setLogEntries((prev) => [...prev, entry]);
  }, []);

  const clearLog = useCallback(() => {
    setLogEntries([]);
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries.length]);

  const {
    params,
    loading,
    error,
    dirtyParams,
    hasRamWrites,
    loadProgress,
    hasLoaded,
    missingOptional,
    refresh,
    setLocalValue,
    saveAllToRam,
    commitToFlash,
  } = usePanelParams({
    paramNames,
    optionalParams,
    panelId: "frame",
    onEvent: addLogEntry,
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

  // ── Fixed-wing without QuadPlane check ─────────────────────

  const isFixedWingOnly = isPlane && hasLoaded && paramNames.every((p) => missingOptional.has(p));

  // ── Derived state ──────────────────────────────────────────

  const classParam = isPlane ? "Q_FRAME_CLASS" : "FRAME_CLASS";
  const typeParam = isPlane ? "Q_FRAME_TYPE" : "FRAME_TYPE";
  const frameClass = params.get(classParam) ?? 1;
  const frameType = params.get(typeParam) ?? 1;
  const hasDirty = dirtyParams.size > 0;

  // Deduplicated type options for the selected class
  const uniqueTypes = useMemo(() => getUniqueTypesForClass(frameClass), [frameClass]);

  const frameTypeOptions = useMemo(() => {
    if (uniqueTypes.length === 0) {
      return [{ value: "0", label: "0 — Default" }];
    }
    return uniqueTypes.map((ut) => {
      const dupCount = ut.duplicateTypes.length;
      const desc = ut.description
        ?? (dupCount > 1 ? `Covers types ${ut.duplicateTypes.join(", ")}` : undefined);
      return {
        value: String(ut.value),
        label: `${ut.value} — ${ut.name}`,
        description: desc,
      };
    });
  }, [uniqueTypes]);

  // Find the effective selected value in the deduplicated dropdown
  const effectiveFrameType = useMemo(() => {
    for (const ut of uniqueTypes) {
      if (ut.duplicateTypes.includes(frameType)) {
        return ut.value;
      }
    }
    return uniqueTypes[0]?.value ?? 0;
  }, [uniqueTypes, frameType]);

  // Auto-reset frame type when the selected class changes and current type is invalid
  useEffect(() => {
    if (uniqueTypes.length > 0) {
      const isValid = uniqueTypes.some((ut) => ut.duplicateTypes.includes(frameType));
      if (!isValid) {
        setLocalValue(typeParam, uniqueTypes[0].value);
      }
    }
  }, [frameClass, frameType, uniqueTypes, setLocalValue, typeParam]);

  const layout = useMemo(
    () => getMotorLayout(frameClass, frameType),
    [frameClass, frameType],
  );

  const className = FRAME_CLASS_NAMES[frameClass] ?? "Unknown";
  const typeName = layout?.typeName ?? "Unknown";
  const motorCountStr = layout ? formatMotorCount(layout) : "—";
  const classNote = FRAME_CLASS_NOTES[frameClass];
  const classDescription = FRAME_CLASS_DESCRIPTIONS[frameClass];

  // Find the description for the currently effective type
  const activeTypeEntry = uniqueTypes.find((ut) => ut.value === effectiveFrameType);
  const typeDescription = activeTypeEntry?.description ?? FRAME_TYPE_DESCRIPTIONS[frameType];

  // Log local value changes
  const handleLocalChange = useCallback(
    (name: string, value: number) => {
      setLocalValue(name, value);
      if (name === classParam) {
        const clsName = FRAME_CLASS_NAMES[value] ?? "Unknown";
        addLogEntry({ type: "info", message: `Set ${name} = ${value} (${clsName})` });
      } else {
        addLogEntry({ type: "info", message: `Set ${name} = ${value} (local)` });
      }
    },
    [setLocalValue, addLogEntry, classParam],
  );

  // ── Save / Flash ───────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) {
      toast("Frame parameters saved to RAM", "success");
    } else {
      toast("Failed to save frame parameters", "error");
    }
  }, [saveAllToRam, toast]);

  const handleFlash = useCallback(async () => {
    setCommitting(true);
    const ok = await commitToFlash();
    setCommitting(false);
    if (ok) {
      toast("Written to flash — persists after reboot", "success");
    } else {
      toast("Failed to write to flash", "error");
    }
  }, [commitToFlash, toast]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <ArmedLockOverlay>
      <div className="flex-1 overflow-hidden flex">
        {/* Left column — main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            <PanelHeader
              title="Frame Configuration"
              subtitle="Vehicle frame class, type, and motor layout"
              icon={<Box size={16} />}
              loading={loading}
              loadProgress={loadProgress}
              hasLoaded={hasLoaded}
              onRead={refresh}
              connected={connected}
              error={error}
            />

            {/* Fixed-wing only message */}
            {isFixedWingOnly && (
              <Card icon={<Box size={14} />} title="Frame Configuration" description="Not applicable for this vehicle type">
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-text-secondary">
                    Frame configuration is not applicable for fixed-wing aircraft.
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    QuadPlane frame settings (Q_FRAME_CLASS) are available when your plane has VTOL motors configured.
                  </p>
                </div>
              </Card>
            )}

            {/* Frame Class & Type */}
            {!isFixedWingOnly && (
            <Card icon={<Box size={14} />} title="Frame Selection" description="Select airframe class and configuration type">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label={classParam}
                  options={FRAME_CLASS_OPTIONS}
                  value={String(frameClass)}
                  onChange={(v) => handleLocalChange(classParam, Number(v))}
                  disabled={isLocked}
                  searchable
                />
                <Select
                  label={typeParam}
                  options={frameTypeOptions}
                  value={String(effectiveFrameType)}
                  onChange={(v) => handleLocalChange(typeParam, Number(v))}
                  disabled={isLocked}
                />
              </div>
              {typeDescription && (
                <p className="text-[10px] text-text-tertiary mt-2">
                  {typeDescription}
                </p>
              )}
              {classNote && (
                <div className="flex items-start gap-2 mt-3 px-2.5 py-2 border border-accent-primary/20 bg-accent-primary/5">
                  <Info size={12} className="text-accent-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    {classNote}
                  </p>
                </div>
              )}
            </Card>
            )}

            {/* Motor Layout Diagram — 3D only */}
            {!isFixedWingOnly && (
            <Card
              icon={<Zap size={14} />}
              title="Motor Layout"
              description={`${className} ${typeName} — ${motorCountStr}`}
            >
              {loading && !layout ? (
                <div className="h-[360px] flex items-center justify-center text-xs text-text-tertiary bg-bg-tertiary animate-pulse">
                  Loading parameters...
                </div>
              ) : layout ? (
                <MotorDiagram3D layout={layout} />
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-xs text-text-secondary">
                    {frameClass === 0
                      ? "Select a frame class to see the motor layout."
                      : `No motor layout diagram for ${className}.`}
                  </p>
                  {classDescription && frameClass !== 0 && (
                    <p className="text-[10px] text-text-tertiary">
                      {classDescription}. {classParam} will still be sent to the flight controller.
                    </p>
                  )}
                </div>
              )}
            </Card>
            )}

            {/* Info Row */}
            {!isFixedWingOnly && (
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <div>
                <span className="text-text-tertiary">Motors: </span>
                <span className="font-mono text-text-primary">{layout ? motorCountStr : "—"}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Class: </span>
                <span className="font-mono text-text-primary">{className}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Type: </span>
                <span className="font-mono text-text-primary">{typeName}</span>
              </div>
            </div>
            )}

            {/* Save / Flash */}
            {!isFixedWingOnly && (
            <div className="flex items-center gap-3 pt-2 pb-4">
              <Button
                variant="primary"
                size="lg"
                icon={<Save size={14} />}
                disabled={!hasDirty || isLocked}
                loading={saving}
                onClick={handleSave}
              >
                Save to RAM
              </Button>
              {hasRamWrites && (
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<HardDrive size={14} />}
                  loading={committing}
                  onClick={handleFlash}
                >
                  Write to Flash
                </Button>
              )}
              {hasDirty && (
                <span className="text-[10px] text-status-warning">Unsaved changes</span>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Right column — Config Log */}
        <div className="w-[280px] shrink-0 border-l border-border-default bg-bg-secondary overflow-hidden flex-col hidden xl:flex">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
            <h3 className="text-xs font-medium text-text-primary">Config Log</h3>
            <button
              onClick={clearLog}
              className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
              title="Clear log"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
            {logEntries.length === 0 ? (
              <p className="text-text-tertiary text-center py-4">
                No events yet. Read from FC to start.
              </p>
            ) : (
              logEntries.map((entry) => (
                <div key={entry.id} className="flex gap-1.5 leading-relaxed">
                  <span className="text-text-tertiary shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className={LOG_TYPE_COLORS[entry.type]}>
                    {entry.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </ArmedLockOverlay>
  );
}

// ── Sub-components ────────────────────────────────────────────

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
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
