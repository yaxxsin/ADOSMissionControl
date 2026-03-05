/**
 * @module PatternEditor
 * @description Right panel section for configuring flight patterns (survey, orbit, corridor, SAR, structure scan).
 * Shows relevant controls based on active pattern type, generation stats, and Generate/Clear buttons.
 * Integrates GSD calculator for survey mode: camera profile dropdown auto-computes line spacing.
 * @license GPL-3.0-only
 */
"use client";

import { useCallback } from "react";
import { Select } from "@/components/ui/select";
import { usePatternStore } from "@/stores/pattern-store";
import { useDrawingStore } from "@/stores/drawing-store";
import { formatDistance, formatArea } from "@/lib/drawing/geo-utils";
import { Play, Trash2, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PATTERN_TYPE_OPTIONS, VALID_PATTERN_TYPES } from "./pattern-editor-constants";
import {
  SurveyConfig, OrbitConfig, CorridorConfig,
  SarExpandingSquareConfig, SarSectorSearchConfig, SarParallelTrackConfig,
  StructureScanConfig,
} from "./PatternConfigSections";

interface PatternEditorProps {
  onApply?: () => void;
}

export function PatternEditor({ onApply }: PatternEditorProps) {
  const activeType = usePatternStore((s) => s.activePatternType);
  const setPatternType = usePatternStore((s) => s.setPatternType);
  const surveyConfig = usePatternStore((s) => s.surveyConfig);
  const orbitConfig = usePatternStore((s) => s.orbitConfig);
  const structureScanConfig = usePatternStore((s) => s.structureScanConfig);
  const updateSurveyConfig = usePatternStore((s) => s.updateSurveyConfig);
  const updateOrbitConfig = usePatternStore((s) => s.updateOrbitConfig);
  const updateStructureScanConfig = usePatternStore((s) => s.updateStructureScanConfig);
  const generate = usePatternStore((s) => s.generate);
  const clear = usePatternStore((s) => s.clear);
  const patternResult = usePatternStore((s) => s.patternResult);
  const isGenerating = usePatternStore((s) => s.isGenerating);
  const error = usePatternStore((s) => s.error);

  const drawnPolygons = useDrawingStore((s) => s.polygons);
  const drawnCircles = useDrawingStore((s) => s.circles);

  const handleTypeChange = useCallback(
    (value: string) => {
      if (VALID_PATTERN_TYPES.has(value)) setPatternType(value as typeof activeType);
    },
    [setPatternType]
  );

  const handleGenerate = useCallback(() => {
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
        <Select label="Pattern Type" options={PATTERN_TYPE_OPTIONS} value="" onChange={handleTypeChange} placeholder="Select pattern..." />
        <p className="text-[10px] font-mono text-text-tertiary mt-2">
          Draw a polygon or circle on the map, then select a pattern type to generate waypoints.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <Select label="Pattern Type" options={PATTERN_TYPE_OPTIONS} value={activeType} onChange={handleTypeChange} />
      {activeType === "survey" && <SurveyConfig />}
      {activeType === "orbit" && <OrbitConfig />}
      {activeType === "corridor" && <CorridorConfig />}
      {activeType === "expandingSquare" && <SarExpandingSquareConfig />}
      {activeType === "sectorSearch" && <SarSectorSearchConfig />}
      {activeType === "parallelTrack" && <SarParallelTrackConfig />}
      {activeType === "structureScan" && <StructureScanConfig />}

      {/* Generate / Clear buttons */}
      <div className="flex gap-2">
        <button onClick={handleGenerate} disabled={isGenerating}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono font-semibold transition-colors cursor-pointer",
            "bg-accent-primary/20 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/30",
            isGenerating && "opacity-50 cursor-wait"
          )}>
          <Play size={12} />{isGenerating ? "Generating..." : "Generate"}
        </button>
        <button onClick={clear}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono text-text-secondary border border-border-default hover:bg-bg-tertiary transition-colors cursor-pointer">
          <Trash2 size={12} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-status-error/10 border border-status-error/20">
          <AlertTriangle size={12} className="text-status-error shrink-0" />
          <span className="text-[10px] font-mono text-status-error">{error}</span>
        </div>
      )}

      {patternResult && (
        <div className="border border-border-default p-2">
          <div className="text-[10px] font-mono text-text-tertiary mb-1">Pattern Stats</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
            <span className="text-text-secondary">Distance</span>
            <span className="text-text-primary">{formatDistance(patternResult.stats.totalDistance)}</span>
            <span className="text-text-secondary">Est. Time</span>
            <span className="text-text-primary">{Math.floor(patternResult.stats.estimatedTime / 60)}m {Math.round(patternResult.stats.estimatedTime % 60)}s</span>
            <span className="text-text-secondary">Waypoints</span>
            <span className="text-text-primary">{patternResult.waypoints.length}</span>
            {patternResult.stats.photoCount > 0 && (<>
              <span className="text-text-secondary">Photos</span>
              <span className="text-text-primary">{patternResult.stats.photoCount}</span>
            </>)}
            {patternResult.stats.coveredArea > 0 && (<>
              <span className="text-text-secondary">Area</span>
              <span className="text-text-primary">{formatArea(patternResult.stats.coveredArea)}</span>
            </>)}
            {patternResult.stats.transectCount > 0 && (<>
              <span className="text-text-secondary">Transects</span>
              <span className="text-text-primary">{patternResult.stats.transectCount}</span>
            </>)}
          </div>
        </div>
      )}

      {patternResult && onApply && (
        <button onClick={onApply}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-2 text-xs font-mono font-semibold",
            "bg-accent-lime/20 text-accent-lime border border-accent-lime/30 hover:bg-accent-lime/30 transition-colors cursor-pointer"
          )}>
          <Check size={12} />Apply to Mission ({patternResult.waypoints.length} WP)
        </button>
      )}
    </div>
  );
}
