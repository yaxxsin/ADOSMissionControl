"use client";

import { useState, useCallback, useRef } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import {
  Monitor, Eye, EyeOff, Save, RotateCcw, Grid3x3,
  Layers, Upload, Download, HardDrive,
} from "lucide-react";

interface OsdElement {
  id: string;
  label: string;
  shortLabel: string;
  enabled: boolean;
  row: number;
  col: number;
}

const DEFAULT_ELEMENTS: OsdElement[] = [
  { id: "ALTITUDE", label: "Altitude", shortLabel: "ALT", enabled: true, row: 1, col: 1 },
  { id: "BATTVOLT", label: "Battery Voltage", shortLabel: "BATT", enabled: true, row: 1, col: 23 },
  { id: "RSSI", label: "RSSI", shortLabel: "RSSI", enabled: true, row: 0, col: 26 },
  { id: "CURRENT", label: "Current", shortLabel: "AMP", enabled: true, row: 2, col: 23 },
  { id: "SATS", label: "GPS Satellites", shortLabel: "SAT", enabled: true, row: 0, col: 1 },
  { id: "FLTMODE", label: "Flight Mode", shortLabel: "MODE", enabled: true, row: 14, col: 12 },
  { id: "MESSAGES", label: "Messages", shortLabel: "MSG", enabled: true, row: 13, col: 1 },
  { id: "GSPEED", label: "Ground Speed", shortLabel: "GS", enabled: true, row: 8, col: 1 },
  { id: "HORIZON", label: "Horizon", shortLabel: "HOR", enabled: true, row: 7, col: 12 },
  { id: "COMPASS", label: "Compass", shortLabel: "CMP", enabled: true, row: 14, col: 1 },
  { id: "WIND", label: "Wind", shortLabel: "WND", enabled: false, row: 3, col: 1 },
  { id: "ASPEED", label: "Air Speed", shortLabel: "AS", enabled: false, row: 9, col: 1 },
  { id: "VSPEED", label: "Vertical Speed", shortLabel: "VS", enabled: true, row: 10, col: 1 },
  { id: "THROTTLE", label: "Throttle", shortLabel: "THR", enabled: true, row: 8, col: 23 },
  { id: "HEADING", label: "Heading", shortLabel: "HDG", enabled: true, row: 0, col: 12 },
  { id: "HOMEDIST", label: "Home Distance", shortLabel: "DIST", enabled: true, row: 14, col: 23 },
  { id: "HOMEDIR", label: "Home Direction", shortLabel: "DIR", enabled: false, row: 13, col: 23 },
  { id: "POWER", label: "Power", shortLabel: "PWR", enabled: false, row: 3, col: 23 },
  { id: "CELLVOLT", label: "Cell Voltage", shortLabel: "CELL", enabled: false, row: 4, col: 23 },
  { id: "BATBAR", label: "Battery Bar", shortLabel: "BAR", enabled: false, row: 5, col: 23 },
  { id: "ARMING", label: "Arming Status", shortLabel: "ARM", enabled: true, row: 7, col: 12 },
  { id: "CLIMBEFF", label: "Climb Efficiency", shortLabel: "CE", enabled: false, row: 11, col: 1 },
  { id: "EFF", label: "Efficiency", shortLabel: "EFF", enabled: false, row: 12, col: 1 },
  { id: "BATUSED", label: "Battery Used", shortLabel: "mAh", enabled: true, row: 3, col: 23 },
  { id: "CLK", label: "Clock", shortLabel: "CLK", enabled: false, row: 0, col: 22 },
  { id: "ROLL_ANGLE", label: "Roll Angle", shortLabel: "ROLL", enabled: false, row: 6, col: 1 },
  { id: "PITCH_ANGLE", label: "Pitch Angle", shortLabel: "PTCH", enabled: false, row: 7, col: 1 },
];

const PRESETS: Record<string, Partial<Record<string, { enabled: boolean; row: number; col: number }>>> = {
  Racing: {
    ALTITUDE: { enabled: true, row: 1, col: 1 },
    BATTVOLT: { enabled: true, row: 1, col: 24 },
    RSSI: { enabled: true, row: 0, col: 26 },
    FLTMODE: { enabled: true, row: 14, col: 12 },
    THROTTLE: { enabled: true, row: 8, col: 24 },
    ARMING: { enabled: true, row: 7, col: 12 },
  },
  Cruise: {
    ALTITUDE: { enabled: true, row: 1, col: 1 },
    BATTVOLT: { enabled: true, row: 1, col: 23 },
    RSSI: { enabled: true, row: 0, col: 26 },
    SATS: { enabled: true, row: 0, col: 1 },
    FLTMODE: { enabled: true, row: 14, col: 12 },
    GSPEED: { enabled: true, row: 8, col: 1 },
    HEADING: { enabled: true, row: 0, col: 12 },
    HOMEDIST: { enabled: true, row: 14, col: 23 },
    HORIZON: { enabled: true, row: 7, col: 12 },
    COMPASS: { enabled: true, row: 14, col: 1 },
    VSPEED: { enabled: true, row: 10, col: 1 },
    CURRENT: { enabled: true, row: 2, col: 23 },
    BATUSED: { enabled: true, row: 3, col: 23 },
    MESSAGES: { enabled: true, row: 13, col: 1 },
    ARMING: { enabled: true, row: 7, col: 12 },
  },
  Minimal: {
    BATTVOLT: { enabled: true, row: 0, col: 24 },
    FLTMODE: { enabled: true, row: 14, col: 12 },
    ARMING: { enabled: true, row: 7, col: 12 },
  },
};

const GRID_COLS = 30;
const GRID_ROWS = 16;

export function OsdEditorPanel() {
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);

  const [elements, setElements] = useState<OsdElement[]>(DEFAULT_ELEMENTS);
  const [activeScreen, setActiveScreen] = useState(1);
  const [dragElement, setDragElement] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showCommitButton, setShowCommitButton] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  const toggleElement = (id: string) => {
    setElements((prev) =>
      prev.map((el) => el.id === id ? { ...el, enabled: !el.enabled } : el)
    );
  };

  const handleGridMouseDown = (id: string) => {
    setDragElement(id);
  };

  const handleGridMouseUp = () => {
    setDragElement(null);
  };

  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragElement || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((x / rect.width) * GRID_COLS)));
      const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((y / rect.height) * GRID_ROWS)));

      setElements((prev) =>
        prev.map((el) => el.id === dragElement ? { ...el, row, col } : el)
      );
    },
    [dragElement]
  );

  const loadPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;

    setElements((prev) =>
      prev.map((el) => {
        const p = preset[el.id];
        if (p) return { ...el, ...p };
        return { ...el, enabled: false };
      })
    );
  };

  const handleSave = useCallback(async () => {
    const drone = getSelectedDrone();
    if (!drone) return;

    setSaving(true);
    const screenPrefix = `OSD_SCREEN${activeScreen}_`;

    for (const el of elements) {
      const paramName = `${screenPrefix}${el.id}`;
      // ArduPilot encoding: (enable << 15) | (row << 5) | col
      const value = (el.enabled ? 1 << 15 : 0) | (el.row << 5) | el.col;
      try {
        await drone.protocol.setParameter(paramName, value);
      } catch {
        // Some params might not exist on all firmwares
      }
    }

    setShowCommitButton(true);
    setSaving(false);
  }, [elements, activeScreen, getSelectedDrone]);

  const commitToFlash = useCallback(async () => {
    const drone = getSelectedDrone();
    if (!drone) return;
    await drone.protocol.commitParamsToFlash();
    setShowCommitButton(false);
  }, [getSelectedDrone]);

  const handleReset = () => {
    setElements(DEFAULT_ELEMENTS);
  };

  const enabledElements = elements.filter((el) => el.enabled);

  return (
    <div className="h-full flex">
      {/* Sidebar — Element list */}
      <div className="w-[220px] border-r border-border-default bg-bg-secondary flex-shrink-0 flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-border-default">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Layers size={12} />
            OSD Elements
          </h2>
        </div>

        {/* Screen selector */}
        <div className="flex border-b border-border-default">
          {[1, 2, 3, 4].map((screen) => (
            <button
              key={screen}
              onClick={() => setActiveScreen(screen)}
              className={`flex-1 py-2 text-[10px] font-semibold cursor-pointer ${
                activeScreen === screen
                  ? "text-accent-primary border-b-2 border-accent-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Screen {screen}
            </button>
          ))}
        </div>

        {/* Preset buttons */}
        <div className="flex gap-1 p-2 border-b border-border-default">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => loadPreset(name)}
              className="flex-1 px-2 py-1 text-[10px] text-text-secondary border border-border-default hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Element list */}
        <div className="flex-1 overflow-y-auto">
          {elements.map((el) => (
            <button
              key={el.id}
              onClick={() => toggleElement(el.id)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left cursor-pointer ${
                el.enabled ? "text-text-primary" : "text-text-tertiary"
              } hover:bg-bg-tertiary`}
            >
              {el.enabled ? (
                <Eye size={12} className="text-accent-primary shrink-0" />
              ) : (
                <EyeOff size={12} className="shrink-0" />
              )}
              <span className="truncate">{el.label}</span>
              {el.enabled && (
                <span className="ml-auto text-[10px] text-text-tertiary font-mono">
                  {el.row},{el.col}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="p-2 border-t border-border-default space-y-1">
          <button
            onClick={handleSave}
            disabled={!selectedDroneId || saving}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold bg-accent-primary text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save size={12} />
            {saving ? "Saving..." : "Save to FC"}
          </button>
          {showCommitButton && (
            <button
              onClick={commitToFlash}
              className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-text-secondary border border-accent-primary/50 hover:text-accent-primary hover:bg-accent-primary/10 cursor-pointer"
            >
              <HardDrive size={12} />
              Write to Flash
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary border border-border-default hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
          >
            <RotateCcw size={12} />
            Reset to Default
          </button>
        </div>
      </div>

      {/* Main area — Grid preview */}
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary p-8">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <Monitor size={14} className="text-text-secondary" />
          <span className="text-xs font-semibold text-text-primary">OSD Preview — Screen {activeScreen}</span>
          <span className="text-[10px] text-text-tertiary">{enabledElements.length} elements active</span>
          <button
            onClick={() => setShowGrid((p) => !p)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer ${showGrid ? "text-accent-primary" : "text-text-tertiary"}`}
          >
            <Grid3x3 size={10} />
            Grid
          </button>
        </div>

        {/* Video preview area (16:9) */}
        <div
          ref={gridRef}
          className="relative bg-black border border-border-default select-none"
          style={{ width: "720px", height: "405px" }}
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseUp}
        >
          {/* Grid lines */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Vertical lines */}
              {Array.from({ length: GRID_COLS - 1 }, (_, i) => (
                <div
                  key={`v${i}`}
                  className="absolute top-0 bottom-0 border-l border-white/5"
                  style={{ left: `${((i + 1) / GRID_COLS) * 100}%` }}
                />
              ))}
              {/* Horizontal lines */}
              {Array.from({ length: GRID_ROWS - 1 }, (_, i) => (
                <div
                  key={`h${i}`}
                  className="absolute left-0 right-0 border-t border-white/5"
                  style={{ top: `${((i + 1) / GRID_ROWS) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* OSD elements */}
          {enabledElements.map((el) => (
            <div
              key={el.id}
              className={`absolute font-mono text-[11px] px-1 cursor-move select-none ${
                dragElement === el.id ? "text-accent-primary bg-accent-primary/20 z-10" : "text-white/90 hover:text-accent-primary hover:bg-accent-primary/10"
              }`}
              style={{
                left: `${(el.col / GRID_COLS) * 100}%`,
                top: `${(el.row / GRID_ROWS) * 100}%`,
              }}
              onMouseDown={() => handleGridMouseDown(el.id)}
            >
              {el.shortLabel}
            </div>
          ))}

          {/* Center crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-[1px] bg-white/20" />
            <div className="w-[1px] h-8 bg-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>

          {/* "NO SIGNAL" if not connected */}
          {!selectedDroneId && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/20 font-mono text-sm tracking-widest">OSD PREVIEW</span>
            </div>
          )}
        </div>

        <p className="text-[10px] text-text-tertiary mt-3">
          Drag elements to reposition. Click elements in sidebar to toggle visibility.
        </p>
      </div>
    </div>
  );
}
