/**
 * @module PatternEditor
 * @description Right panel section for configuring flight patterns (survey, orbit, corridor, SAR, structure scan).
 * Shows relevant controls based on active pattern type, generation stats, and Generate/Clear buttons.
 * Integrates GSD calculator for survey mode: camera profile dropdown auto-computes line spacing.
 * @license GPL-3.0-only
 */
"use client";

import { useCallback, useMemo } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { usePatternStore } from "@/stores/pattern-store";
import { useDrawingStore } from "@/stores/drawing-store";
import { formatDistance, formatArea } from "@/lib/drawing/geo-utils";
import { CAMERA_PROFILES, computeGSD, computeLineSpacing, computeTriggerDistance } from "@/lib/patterns/gsd-calculator";
import { Grid3X3, Circle, Route, Play, Trash2, Search, Building, Camera, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const PATTERN_TYPE_OPTIONS = [
  { value: "survey", label: "Survey Grid" },
  { value: "orbit", label: "Orbit" },
  { value: "corridor", label: "Corridor" },
  { value: "expandingSquare", label: "SAR: Expanding Square" },
  { value: "sectorSearch", label: "SAR: Sector Search" },
  { value: "parallelTrack", label: "SAR: Parallel Track" },
  { value: "structureScan", label: "Structure Scan" },
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

const SCAN_DIRECTION_OPTIONS = [
  { value: "bottom-up", label: "Bottom Up" },
  { value: "top-down", label: "Top Down" },
];

const CAMERA_OPTIONS = [
  { value: "", label: "Manual" },
  ...CAMERA_PROFILES.map((c) => ({ value: c.name, label: c.name })),
];

const VALID_PATTERN_TYPES = new Set(PATTERN_TYPE_OPTIONS.map((o) => o.value));

export function PatternEditor() {
  const activeType = usePatternStore((s) => s.activePatternType);
  const setPatternType = usePatternStore((s) => s.setPatternType);
  const surveyConfig = usePatternStore((s) => s.surveyConfig);
  const orbitConfig = usePatternStore((s) => s.orbitConfig);
  const corridorConfig = usePatternStore((s) => s.corridorConfig);
  const sarExpandingSquareConfig = usePatternStore((s) => s.sarExpandingSquareConfig);
  const sarSectorSearchConfig = usePatternStore((s) => s.sarSectorSearchConfig);
  const sarParallelTrackConfig = usePatternStore((s) => s.sarParallelTrackConfig);
  const structureScanConfig = usePatternStore((s) => s.structureScanConfig);
  const updateSurveyConfig = usePatternStore((s) => s.updateSurveyConfig);
  const updateOrbitConfig = usePatternStore((s) => s.updateOrbitConfig);
  const updateCorridorConfig = usePatternStore((s) => s.updateCorridorConfig);
  const updateSarExpandingSquareConfig = usePatternStore((s) => s.updateSarExpandingSquareConfig);
  const updateSarSectorSearchConfig = usePatternStore((s) => s.updateSarSectorSearchConfig);
  const updateSarParallelTrackConfig = usePatternStore((s) => s.updateSarParallelTrackConfig);
  const updateStructureScanConfig = usePatternStore((s) => s.updateStructureScanConfig);
  const generate = usePatternStore((s) => s.generate);
  const clear = usePatternStore((s) => s.clear);
  const patternResult = usePatternStore((s) => s.patternResult);
  const isGenerating = usePatternStore((s) => s.isGenerating);
  const error = usePatternStore((s) => s.error);

  const drawnPolygons = useDrawingStore((s) => s.polygons);
  const drawnCircles = useDrawingStore((s) => s.circles);

  // GSD state for survey mode - derived from selected camera + altitude
  const selectedCamera = useMemo(
    () => CAMERA_PROFILES.find((c) => c.name === (surveyConfig as { _cameraName?: string })._cameraName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(surveyConfig as { _cameraName?: string })._cameraName]
  );

  const gsdInfo = useMemo(() => {
    if (!selectedCamera) return null;
    const alt = surveyConfig.altitude ?? 50;
    const gsd = computeGSD(alt, selectedCamera.focalLength, selectedCamera.sensorWidth, selectedCamera.imageWidth);
    return { gsd, camera: selectedCamera };
  }, [selectedCamera, surveyConfig.altitude]);

  const handleTypeChange = useCallback(
    (value: string) => {
      if (VALID_PATTERN_TYPES.has(value)) {
        setPatternType(value as typeof activeType);
      }
    },
    [setPatternType]
  );

  const handleCameraChange = useCallback(
    (value: string) => {
      const camera = CAMERA_PROFILES.find((c) => c.name === value);
      if (camera) {
        const alt = surveyConfig.altitude ?? 50;
        const sidelap = 0.6; // 60% default sidelap
        const frontlap = 0.7; // 70% default frontlap
        const lineSpacing = computeLineSpacing(alt, camera, sidelap);
        const triggerDist = computeTriggerDistance(alt, camera, frontlap);
        updateSurveyConfig({
          lineSpacing: Math.round(lineSpacing * 10) / 10,
          cameraTriggerDistance: Math.round(triggerDist * 10) / 10,
          _cameraName: value,
        } as Partial<typeof surveyConfig> & { _cameraName: string });
      } else {
        updateSurveyConfig({ _cameraName: "" } as Partial<typeof surveyConfig> & { _cameraName: string });
      }
    },
    [surveyConfig.altitude, updateSurveyConfig]
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
    if (activeType === "structureScan" && !structureScanConfig.structurePolygon && drawnPolygons.length > 0) {
      updateStructureScanConfig({ structurePolygon: drawnPolygons[drawnPolygons.length - 1].vertices });
    }
    generate();
  }, [activeType, surveyConfig, orbitConfig, structureScanConfig, drawnPolygons, drawnCircles, updateSurveyConfig, updateOrbitConfig, updateStructureScanConfig, generate]);

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
          <Select
            label="Camera Profile"
            options={CAMERA_OPTIONS}
            value={(surveyConfig as { _cameraName?: string })._cameraName ?? ""}
            onChange={handleCameraChange}
          />
          {gsdInfo && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-accent-primary/10 border border-accent-primary/20">
              <Camera size={10} className="text-accent-primary shrink-0" />
              <span className="text-[10px] font-mono text-accent-primary">
                GSD: {(gsdInfo.gsd * 100).toFixed(2)} cm/px
              </span>
            </div>
          )}
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
              onChange={(e) => {
                const alt = parseFloat(e.target.value) || 50;
                updateSurveyConfig({ altitude: alt });
                // Recalculate GSD-based spacing when altitude changes with camera selected
                if (selectedCamera) {
                  const lineSpacing = computeLineSpacing(alt, selectedCamera, 0.6);
                  const triggerDist = computeTriggerDistance(alt, selectedCamera, 0.7);
                  updateSurveyConfig({
                    lineSpacing: Math.round(lineSpacing * 10) / 10,
                    cameraTriggerDistance: Math.round(triggerDist * 10) / 10,
                  });
                }
              }}
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

      {/* SAR: Expanding Square config */}
      {activeType === "expandingSquare" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Search size={12} />
            <span>
              {sarExpandingSquareConfig.center
                ? `Datum: ${sarExpandingSquareConfig.center[0].toFixed(4)}, ${sarExpandingSquareConfig.center[1].toFixed(4)}`
                : "Click map to set datum point"}
            </span>
          </div>
          <Input
            label="Leg Spacing"
            type="number"
            unit="m"
            value={String(sarExpandingSquareConfig.legSpacing ?? 50)}
            onChange={(e) => updateSarExpandingSquareConfig({ legSpacing: parseFloat(e.target.value) || 50 })}
          />
          <Input
            label="Max Legs"
            type="number"
            value={String(sarExpandingSquareConfig.maxLegs ?? 20)}
            onChange={(e) => updateSarExpandingSquareConfig({ maxLegs: parseInt(e.target.value) || 20 })}
          />
          <Input
            label="Start Bearing"
            type="number"
            unit="deg"
            value={String(sarExpandingSquareConfig.startBearing ?? 0)}
            onChange={(e) => updateSarExpandingSquareConfig({ startBearing: parseFloat(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(sarExpandingSquareConfig.altitude ?? 50)}
              onChange={(e) => updateSarExpandingSquareConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(sarExpandingSquareConfig.speed ?? 5)}
              onChange={(e) => updateSarExpandingSquareConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* SAR: Sector Search config */}
      {activeType === "sectorSearch" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Search size={12} />
            <span>
              {sarSectorSearchConfig.center
                ? `Datum: ${sarSectorSearchConfig.center[0].toFixed(4)}, ${sarSectorSearchConfig.center[1].toFixed(4)}`
                : "Click map to set datum point"}
            </span>
          </div>
          <Input
            label="Search Radius"
            type="number"
            unit="m"
            value={String(sarSectorSearchConfig.radius ?? 200)}
            onChange={(e) => updateSarSectorSearchConfig({ radius: parseFloat(e.target.value) || 200 })}
          />
          <Input
            label="Sweeps"
            type="number"
            value={String(sarSectorSearchConfig.sweeps ?? 3)}
            onChange={(e) => updateSarSectorSearchConfig({ sweeps: parseInt(e.target.value) || 3 })}
          />
          <Input
            label="Start Bearing"
            type="number"
            unit="deg"
            value={String(sarSectorSearchConfig.startBearing ?? 0)}
            onChange={(e) => updateSarSectorSearchConfig({ startBearing: parseFloat(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(sarSectorSearchConfig.altitude ?? 50)}
              onChange={(e) => updateSarSectorSearchConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(sarSectorSearchConfig.speed ?? 5)}
              onChange={(e) => updateSarSectorSearchConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* SAR: Parallel Track config */}
      {activeType === "parallelTrack" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Search size={12} />
            <span>
              {sarParallelTrackConfig.startPoint
                ? `Start: ${sarParallelTrackConfig.startPoint[0].toFixed(4)}, ${sarParallelTrackConfig.startPoint[1].toFixed(4)}`
                : "Click map to set start point"}
            </span>
          </div>
          <Input
            label="Track Length"
            type="number"
            unit="m"
            value={String(sarParallelTrackConfig.trackLength ?? 500)}
            onChange={(e) => updateSarParallelTrackConfig({ trackLength: parseFloat(e.target.value) || 500 })}
          />
          <Input
            label="Track Spacing"
            type="number"
            unit="m"
            value={String(sarParallelTrackConfig.trackSpacing ?? 50)}
            onChange={(e) => updateSarParallelTrackConfig({ trackSpacing: parseFloat(e.target.value) || 50 })}
          />
          <Input
            label="Track Count"
            type="number"
            value={String(sarParallelTrackConfig.trackCount ?? 10)}
            onChange={(e) => updateSarParallelTrackConfig({ trackCount: parseInt(e.target.value) || 10 })}
          />
          <Input
            label="Bearing"
            type="number"
            unit="deg"
            value={String(sarParallelTrackConfig.bearing ?? 0)}
            onChange={(e) => updateSarParallelTrackConfig({ bearing: parseFloat(e.target.value) || 0 })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Altitude"
              type="number"
              unit="m"
              value={String(sarParallelTrackConfig.altitude ?? 50)}
              onChange={(e) => updateSarParallelTrackConfig({ altitude: parseFloat(e.target.value) || 50 })}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              value={String(sarParallelTrackConfig.speed ?? 5)}
              onChange={(e) => updateSarParallelTrackConfig({ speed: parseFloat(e.target.value) || 5 })}
            />
          </div>
        </>
      )}

      {/* Structure Scan config */}
      {activeType === "structureScan" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Building size={12} />
            <span>
              {structureScanConfig.structurePolygon
                ? `${structureScanConfig.structurePolygon.length} vertices`
                : drawnPolygons.length > 0
                  ? `Using last drawn polygon (${drawnPolygons[drawnPolygons.length - 1].vertices.length} pts)`
                  : "Draw structure boundary on map"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Bottom Alt"
              type="number"
              unit="m"
              value={String(structureScanConfig.bottomAlt ?? 10)}
              onChange={(e) => updateStructureScanConfig({ bottomAlt: parseFloat(e.target.value) || 10 })}
            />
            <Input
              label="Top Alt"
              type="number"
              unit="m"
              value={String(structureScanConfig.topAlt ?? 50)}
              onChange={(e) => updateStructureScanConfig({ topAlt: parseFloat(e.target.value) || 50 })}
            />
          </div>
          <Input
            label="Layer Spacing"
            type="number"
            unit="m"
            value={String(structureScanConfig.layerSpacing ?? 10)}
            onChange={(e) => updateStructureScanConfig({ layerSpacing: parseFloat(e.target.value) || 10 })}
          />
          <Input
            label="Scan Distance"
            type="number"
            unit="m"
            value={String(structureScanConfig.scanDistance ?? 15)}
            onChange={(e) => updateStructureScanConfig({ scanDistance: parseFloat(e.target.value) || 15 })}
          />
          <Input
            label="Gimbal Pitch"
            type="number"
            unit="deg"
            value={String(structureScanConfig.gimbalPitch ?? -30)}
            onChange={(e) => updateStructureScanConfig({ gimbalPitch: parseFloat(e.target.value) || -30 })}
          />
          <Input
            label="Points Per Layer"
            type="number"
            value={String(structureScanConfig.pointsPerLayer ?? 16)}
            onChange={(e) => updateStructureScanConfig({ pointsPerLayer: parseInt(e.target.value) || 16 })}
          />
          <Select
            label="Direction"
            options={SCAN_DIRECTION_OPTIONS}
            value={structureScanConfig.direction ?? "bottom-up"}
            onChange={(v) => updateStructureScanConfig({ direction: v as "bottom-up" | "top-down" })}
          />
          <Input
            label="Speed"
            type="number"
            unit="m/s"
            value={String(structureScanConfig.speed ?? 3)}
            onChange={(e) => updateStructureScanConfig({ speed: parseFloat(e.target.value) || 3 })}
          />
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

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-status-error/10 border border-status-error/20">
          <AlertTriangle size={12} className="text-status-error shrink-0" />
          <span className="text-[10px] font-mono text-status-error">{error}</span>
        </div>
      )}

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
