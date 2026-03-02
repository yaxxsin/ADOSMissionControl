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
import { generateSurvey } from "@/lib/patterns/survey-generator";
import { generateOrbit } from "@/lib/patterns/orbit-generator";
import { generateCorridor } from "@/lib/patterns/corridor-generator";

interface PatternStoreState {
  activePatternType: "survey" | "orbit" | "corridor" | null;
  surveyConfig: Partial<SurveyConfig>;
  orbitConfig: Partial<OrbitConfig>;
  corridorConfig: Partial<CorridorConfig>;
  patternResult: PatternResult | null;
  isGenerating: boolean;

  setPatternType: (type: "survey" | "orbit" | "corridor" | null) => void;
  updateSurveyConfig: (update: Partial<SurveyConfig>) => void;
  updateOrbitConfig: (update: Partial<OrbitConfig>) => void;
  updateCorridorConfig: (update: Partial<CorridorConfig>) => void;
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

export const usePatternStore = create<PatternStoreState>()((set, get) => ({
  activePatternType: null,
  surveyConfig: { ...defaultSurvey },
  orbitConfig: { ...defaultOrbit },
  corridorConfig: { ...defaultCorridor },
  patternResult: null,
  isGenerating: false,

  setPatternType: (type) =>
    set({ activePatternType: type, patternResult: null }),

  updateSurveyConfig: (update) =>
    set((s) => ({ surveyConfig: { ...s.surveyConfig, ...update } })),

  updateOrbitConfig: (update) =>
    set((s) => ({ orbitConfig: { ...s.orbitConfig, ...update } })),

  updateCorridorConfig: (update) =>
    set((s) => ({ corridorConfig: { ...s.corridorConfig, ...update } })),

  generate: () => {
    const { activePatternType, surveyConfig, orbitConfig, corridorConfig } = get();
    if (!activePatternType) return;

    set({ isGenerating: true });

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
      }
    } catch {
      result = null;
    }

    set({ patternResult: result, isGenerating: false });
  },

  clear: () =>
    set({
      activePatternType: null,
      surveyConfig: { ...defaultSurvey },
      orbitConfig: { ...defaultOrbit },
      corridorConfig: { ...defaultCorridor },
      patternResult: null,
      isGenerating: false,
    }),
}));
