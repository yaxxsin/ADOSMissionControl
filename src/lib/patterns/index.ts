/**
 * @module patterns
 * @description Barrel export for flight pattern generators and dispatcher.
 * @license GPL-3.0-only
 */

export { generateSurvey } from "./survey-generator";
export { generateOrbit } from "./orbit-generator";
export { generateCorridor } from "./corridor-generator";
export * from "./types";

import type { PatternConfig, PatternResult } from "./types";
import { generateSurvey } from "./survey-generator";
import { generateOrbit } from "./orbit-generator";
import { generateCorridor } from "./corridor-generator";

/**
 * Dispatch to the correct pattern generator based on config type.
 */
export function generatePattern(config: PatternConfig): PatternResult {
  switch (config.type) {
    case "survey":
      return generateSurvey(config.config);
    case "orbit":
      return generateOrbit(config.config);
    case "corridor":
      return generateCorridor(config.config);
  }
}
