/**
 * @module PatternEditor
 * @description Right panel section for configuring flight patterns (survey, orbit, corridor).
 * Shows relevant controls based on active pattern type, generation stats, and Generate/Clear buttons.
 * @license GPL-3.0-only
 */
"use client";

import { useCallback } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { usePatternStore } from "@/stores/pattern-store";
import { useDrawingStore } from "@/stores/drawing-store";
import { formatDistance, formatArea } from "@/lib/drawing/geo-utils";
import { Grid3X3, Circle, Route, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PATTERN_TYPE_OPTIONS = [
  { value: "survey", label: "Survey Grid" },
  { value: "orbit", label: "Orbit" },
  { value: "corridor", label: "Corridor" },
];

const ENTRY_LOCATION_OPTIONS = [
  { value: "topLeft", label: "Top Left" },
  { value: "topRight", label: "Top Right" },
  { value: "bottomLeft", label: "Bottom Left" },
  { value: "bottomRight", label: "Bottom Right" },
];

const DIRECTION_OPTIONS = [
  { value: "cw", label: "Clockwise" },
  { value: "ccw", label: "Counter-clockwise" },
];

export function PatternEditor() {
  const activeType = usePatternStore((s) => s.activePatternType);
  const setPatternType = usePatternStore((s) => s.setPatternType);
  const surveyConfig = usePatternStore((s) => s.surveyConfig);
  const orbitConfig = usePatternStore((s) => s.orbitConfig);
  const corridorConfig = usePatternStore((s) => s.corridorConfig);
  const updateSurveyConfig = usePatternStore((s) => s.updateSurveyConfig);
  const updateOrbitConfig = usePatternStore((s) => s.updateOrbitConfig);
  const updateCorridorConfig = usePatternStore((s) => s.updateCorridorConfig);
  const generate = usePatternStore((s) => s.generate);
  const clear = usePatternStore((s) => s.clear);
  const patternResult = usePatternStore((s) => s.patternResult);
  const isGenerating = usePatternStore((s) => s.isGenerating);

  const drawnPolygons = useDrawingStore((s) => s.polygons);
  const drawnCircles = useDrawingStore((s) => s.circles);

  const handleTypeChange = useCallback(
    (value: string) => {
      if (value === "survey" || value === "orbit" || value === "corridor") {
        setPatternType(value);
      }
    },
    [setPatternType]
  );

  const handleGenerate = useCallback(() => {
    // Auto-set polygon from drawn shapes if not already set
    if (activeType === "survey" && !surveyConfig.polygon && drawnPolygons.length > 0) {
      updateSurveyConfig({ polygon: drawnPolygons[drawnPolygons.length - 1].vertices });
    }
    if (activeType === "orbit" && !orbitConfig.center && drawnCircles.length > 0) {
      const lastCircle = drawnCircles[drawnCircles.length - 1];
      updateOrbitConfig({ center: lastCircle.center, radius: lastCircle.radius });
    }
    generate();
  }, [activeType, surveyConfig, orbitConfig, drawnPolygons, drawnCircles, updateSurveyConfig, updateOrbitConfig, generate]);

  if (!activeType) {
    return (
      <div className="px-3 py-2">
        <Select
          label="Pattern Type"
          options={PATTERN_TYPE_OPTIONS}
          value=""
          onChange={handleTypeChange}
          placeholder="Select pattern..."
        />
        <p className="text-[10px] font-mono text-text-tertiary mt-2">
          Draw a polygon or circle on the map, then select a pattern type to generate waypoints.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <Select
        label="Pattern Type"
        options={PATTERN_TYPE_OPTIONS}
        value={activeType}
        onChange={handleTypeChange}
      />

      {/* Survey config */}
      {activeType === "survey" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Grid3X3 size={12} />
            <span>
              {surveyConfig.polygon
                ? `${surveyConfig.polygon.length} vertices`
                : drawnPolygons.length > 0
                  ? `Using last drawn polygon (${drawnPolygons[drawnPolygons.length - 1].vertices.length} pts)`
                  : "Draw a polygon on map first"}
            </span>
          </div>
          <Input
            label="Grid Angle"
            type="number"
            unit="deg"
            value={String(surveyConfig.gridAngle ?? 0)}
            onChange={(e) => updateSurveyConfig({ gridAngle: parseFloat(e.target.value) || 0 })}
          />
          <Input
            label="Line Spacing"
            type="number"
            unit="m"
            value={String(surveyConfig.lineSpacing ?? 25)}
            onChange={(e) => updateSurveyConfig({ lineSpacing: parseFloat(e.target.value) || 25 })}
          />
          <Input
            label="Turn-around Distance"
            type="number"
            unit="m"
            value={String(surveyConfig.turnAroundDistance ?? 10)}
            onChange={(e) => updateSurveyConfig({ turnAroundDistance: parseFloat(e.target.value) || 10 })}
          />
          <Select
            label="Entry Point"
            options={ENTRY_LOCATION_OPTIONS}
            value={surveyConfig.entryLocation ?? "topLeft"}
            onChange={(v) => updateSurveyConfig({ entryLocation: v as "topLeft" | "topRight" | "bottomLeft" | "bottomRight" })}
          />
          <Toggle
            label="Alternate Transects"
            checked={surveyConfig.flyAlternateTransects ?? false}
            onChange={(v) => updateSurveyConfig({ flyAlternateTransects: v })}
          />
          <Input
            label="Camera Trigger Dist"
            type="number"
            unit="m"
            placeholder="0 = off"
            value={String(surveyConfig.cameraTriggerDistance ?? 0)}
            onChange={(e) => updateSurveyConfig({ cameraTriggerDistance: parseFloat(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(surveyConfig.altitude ?? 50)}
              onChange={(e) => updateSurveyConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(surveyConfig.speed ?? 5)}
              onChange={(e) => updateSurveyConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* Orbit config */}
      {activeType === "orbit" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Circle size={12} />
            <span>
              {orbitConfig.center
                ? `Center: ${orbitConfig.center[0].toFixed(4)}, ${orbitConfig.center[1].toFixed(4)}`
                : drawnCircles.length > 0
                  ? "Using last drawn circle"
                  : "Draw a circle on map first"}
            </span>
          </div>
          <Input
            label="Radius"
            type="number"
            unit="m"
            value={String(orbitConfig.radius ?? 50)}
            onChange={(e) => updateOrbitConfig({ radius: parseFloat(e.target.value) || 50 })}
          />
          <Select
            label="Direction"
            options={DIRECTION_OPTIONS}
            value={orbitConfig.direction ?? "cw"}
            onChange={(v) => updateOrbitConfig({ direction: v as "cw" | "ccw" })}
          />
          <Input
            label="Turns"
            type="number"
            value={String(orbitConfig.turns ?? 1)}
            onChange={(e) => updateOrbitConfig({ turns: parseInt(e.target.value) || 1 })}
          />
          <Input
            label="Start Angle"
            type="number"
            unit="deg"
            placeholder="0 = North"
            value={String(orbitConfig.startAngle ?? 0)}
            onChange={(e) => updateOrbitConfig({ startAngle: parseFloat(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(orbitConfig.altitude ?? 50)}
              onChange={(e) => updateOrbitConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(orbitConfig.speed ?? 5)}
              onChange={(e) => updateOrbitConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* Corridor config */}
      {activeType === "corridor" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Route size={12} />
            <span>
              {corridorConfig.pathPoints
                ? `${corridorConfig.pathPoints.length} path points`
                : "Draw corridor center line on map (measure tool)"}
            </span>
          </div>
          <Input
            label="Corridor Width"
            type="number"
            unit="m"
            value={String(corridorConfig.corridorWidth ?? 50)}
            onChange={(e) => updateCorridorConfig({ corridorWidth: parseFloat(e.target.value) || 50 })}
          />
          <Input
            label="Line Spacing"
            type="number"
            unit="m"
            value={String(corridorConfig.lineSpacing ?? 20)}
            onChange={(e) => updateCorridorConfig({ lineSpacing: parseFloat(e.target.value) || 20 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(corridorConfig.altitude ?? 50)}
              onChange={(e) => updateCorridorConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(corridorConfig.speed ?? 5)}
              onChange={(e) => updateCorridorConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* Generate / Clear buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono font-semibold transition-colors cursor-pointer",
            "bg-accent-primary/20 text-accent-primary border border-accent-primary/30",
            "hover:bg-accent-primary/30",
            isGenerating && "opacity-50 cursor-wait"
          )}
        >
          <Play size={12} />
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={clear}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono
            text-text-secondary border border-border-default hover:bg-bg-tertiary transition-colors cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Stats display */}
      {patternResult && (
        <div className="border border-border-default p-2">
          <div className="text-[10px] font-mono text-text-tertiary mb-1">Pattern Stats</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
            <span className="text-text-secondary">Distance</span>
            <span className="text-text-primary">{formatDistance(patternResult.stats.totalDistance)}</span>
            <span className="text-text-secondary">Est. Time</span>
            <span className="text-text-primary">
              {Math.floor(patternResult.stats.estimatedTime / 60)}m {Math.round(patternResult.stats.estimatedTime % 60)}s
            </span>
            <span className="text-text-secondary">Waypoints</span>
            <span className="text-text-primary">{patternResult.waypoints.length}</span>
            {patternResult.stats.photoCount > 0 && (
              <>
                <span className="text-text-secondary">Photos</span>
                <span className="text-text-primary">{patternResult.stats.photoCount}</span>
              </>
            )}
            {patternResult.stats.coveredArea > 0 && (
              <>
                <span className="text-text-secondary">Area</span>
                <span className="text-text-primary">{formatArea(patternResult.stats.coveredArea)}</span>
              </>
            )}
            {patternResult.stats.transectCount > 0 && (
              <>
                <span className="text-text-secondary">Transects</span>
                <span className="text-text-primary">{patternResult.stats.transectCount}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
