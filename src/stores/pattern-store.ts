/**
 * @module pattern-store
 * @description Zustand store for flight pattern generation state.
 * Holds config for each pattern type, the generated result, and actions
 * to update config, trigger generation, and clear.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type {
  SurveyConfig,
  OrbitConfig,
  CorridorConfig,
  PatternResult,
} from "@/lib/patterns/types";
import type { ExpandingSquareConfig, SectorSearchConfig, ParallelTrackConfig } from "@/lib/patterns/sar-generators";
import type { StructureScanConfig } from "@/lib/patterns/structure-scan-generator";
import { generateSurvey } from "@/lib/patterns/survey-generator";
import { generateOrbit } from "@/lib/patterns/orbit-generator";
import { generateCorridor } from "@/lib/patterns/corridor-generator";
import { generateExpandingSquare, generateSectorSearch, generateParallelTrack } from "@/lib/patterns/sar-generators";
import { generateStructureScan } from "@/lib/patterns/structure-scan-generator";

type PatternType = "survey" | "orbit" | "corridor" | "expandingSquare" | "sectorSearch" | "parallelTrack" | "structureScan" | null;

interface PatternStoreState {
  activePatternType: PatternType;
  surveyConfig: Partial<SurveyConfig>;
  orbitConfig: Partial<OrbitConfig>;
  corridorConfig: Partial<CorridorConfig>;
  sarExpandingSquareConfig: Partial<ExpandingSquareConfig>;
  sarSectorSearchConfig: Partial<SectorSearchConfig>;
  sarParallelTrackConfig: Partial<ParallelTrackConfig>;
  structureScanConfig: Partial<StructureScanConfig>;
  patternResult: PatternResult | null;
  isGenerating: boolean;
  error: string | null;

  setPatternType: (type: PatternType) => void;
  updateSurveyConfig: (update: Partial<SurveyConfig>) => void;
  updateOrbitConfig: (update: Partial<OrbitConfig>) => void;
  updateCorridorConfig: (update: Partial<CorridorConfig>) => void;
  updateSarExpandingSquareConfig: (update: Partial<ExpandingSquareConfig>) => void;
  updateSarSectorSearchConfig: (update: Partial<SectorSearchConfig>) => void;
  updateSarParallelTrackConfig: (update: Partial<ParallelTrackConfig>) => void;
  updateStructureScanConfig: (update: Partial<StructureScanConfig>) => void;
  generate: () => void;
  clear: () => void;
}

const defaultSurvey: Partial<SurveyConfig> = {
  gridAngle: 0,
  lineSpacing: 25,
  turnAroundDistance: 10,
  entryLocation: "topLeft",
  flyAlternateTransects: false,
  cameraTriggerDistance: 0,
  altitude: 50,
  speed: 5,
};

const defaultOrbit: Partial<OrbitConfig> = {
  radius: 50,
  direction: "cw",
  turns: 1,
  startAngle: 0,
  altitude: 50,
  speed: 5,
};

const defaultCorridor: Partial<CorridorConfig> = {
  corridorWidth: 50,
  lineSpacing: 20,
  altitude: 50,
  speed: 5,
};

const defaultExpandingSquare: Partial<ExpandingSquareConfig> = {
  legSpacing: 50,
  maxLegs: 20,
  altitude: 50,
  speed: 5,
  startBearing: 0,
};

const defaultSectorSearch: Partial<SectorSearchConfig> = {
  radius: 200,
  sweeps: 3,
  altitude: 50,
  speed: 5,
  startBearing: 0,
};

const defaultParallelTrack: Partial<ParallelTrackConfig> = {
  trackLength: 500,
  trackSpacing: 50,
  trackCount: 10,
  bearing: 0,
  altitude: 50,
  speed: 5,
};

const defaultStructureScan: Partial<StructureScanConfig> = {
  bottomAlt: 10,
  topAlt: 50,
  layerSpacing: 10,
  scanDistance: 15,
  gimbalPitch: -30,
  pointsPerLayer: 16,
  cameraTriggerDistance: 0,
  speed: 3,
  direction: "bottom-up",
};

export const usePatternStore = create<PatternStoreState>()((set, get) => ({
  activePatternType: null,
  surveyConfig: { ...defaultSurvey },
  orbitConfig: { ...defaultOrbit },
  corridorConfig: { ...defaultCorridor },
  sarExpandingSquareConfig: { ...defaultExpandingSquare },
  sarSectorSearchConfig: { ...defaultSectorSearch },
  sarParallelTrackConfig: { ...defaultParallelTrack },
  structureScanConfig: { ...defaultStructureScan },
  patternResult: null,
  isGenerating: false,
  error: null,

  setPatternType: (type) =>
    set({ activePatternType: type, patternResult: null, error: null }),

  updateSurveyConfig: (update) =>
    set((s) => ({ surveyConfig: { ...s.surveyConfig, ...update } })),

  updateOrbitConfig: (update) =>
    set((s) => ({ orbitConfig: { ...s.orbitConfig, ...update } })),

  updateCorridorConfig: (update) =>
    set((s) => ({ corridorConfig: { ...s.corridorConfig, ...update } })),

  updateSarExpandingSquareConfig: (update) =>
    set((s) => ({ sarExpandingSquareConfig: { ...s.sarExpandingSquareConfig, ...update } })),

  updateSarSectorSearchConfig: (update) =>
    set((s) => ({ sarSectorSearchConfig: { ...s.sarSectorSearchConfig, ...update } })),

  updateSarParallelTrackConfig: (update) =>
    set((s) => ({ sarParallelTrackConfig: { ...s.sarParallelTrackConfig, ...update } })),

  updateStructureScanConfig: (update) =>
    set((s) => ({ structureScanConfig: { ...s.structureScanConfig, ...update } })),

  generate: () => {
    const {
      activePatternType, surveyConfig, orbitConfig, corridorConfig,
      sarExpandingSquareConfig, sarSectorSearchConfig, sarParallelTrackConfig,
      structureScanConfig,
    } = get();
    if (!activePatternType) return;

    set({ isGenerating: true, error: null });

    let result: PatternResult | null = null;

    try {
      switch (activePatternType) {
        case "survey": {
          const cfg = surveyConfig as SurveyConfig;
          if (cfg.polygon && cfg.polygon.length >= 3) {
            result = generateSurvey(cfg);
          }
          break;
        }
        case "orbit": {
          const cfg = orbitConfig as OrbitConfig;
          if (cfg.center) {
            result = generateOrbit(cfg);
          }
          break;
        }
        case "corridor": {
          const cfg = corridorConfig as CorridorConfig;
          if (cfg.pathPoints && cfg.pathPoints.length >= 2) {
            result = generateCorridor(cfg);
          }
          break;
        }
        case "expandingSquare": {
          const cfg = sarExpandingSquareConfig as ExpandingSquareConfig;
          if (cfg.center) {
            result = generateExpandingSquare(cfg);
          }
          break;
        }
        case "sectorSearch": {
          const cfg = sarSectorSearchConfig as SectorSearchConfig;
          if (cfg.center) {
            result = generateSectorSearch(cfg);
          }
          break;
        }
        case "parallelTrack": {
          const cfg = sarParallelTrackConfig as ParallelTrackConfig;
          if (cfg.startPoint) {
            result = generateParallelTrack(cfg);
          }
          break;
        }
        case "structureScan": {
          const cfg = structureScanConfig as StructureScanConfig;
          if (cfg.structurePolygon && cfg.structurePolygon.length >= 3) {
            result = generateStructureScan(cfg);
          }
          break;
        }
      }
    } catch (err) {
      result = null;
      set({
        error: err instanceof Error ? err.message : "Pattern generation failed",
        patternResult: null,
        isGenerating: false,
      });
      return;
    }

    set({ patternResult: result, isGenerating: false, error: null });
  },

  clear: () =>
    set({
      activePatternType: null,
      surveyConfig: { ...defaultSurvey },
      orbitConfig: { ...defaultOrbit },
      corridorConfig: { ...defaultCorridor },
      sarExpandingSquareConfig: { ...defaultExpandingSquare },
      sarSectorSearchConfig: { ...defaultSectorSearch },
      sarParallelTrackConfig: { ...defaultParallelTrack },
      structureScanConfig: { ...defaultStructureScan },
      patternResult: null,
      isGenerating: false,
      error: null,
    }),
}));
