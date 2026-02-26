/**
 * Frame class/type → motor position/rotation data for ArduPilot.
 *
 * Extracted from referenceCode/MissionPlanner/APMotorLayout.json.
 * Covers the most common multirotor frame configurations.
 * Roll/Pitch coefficients are used as x/y positions in the top-down diagram.
 *
 * @license GPL-3.0-only
 */

// ── Types ─────────────────────────────────────────────────────

export interface MotorPosition {
  number: number;
  testOrder: number;
  rotation: "CW" | "CCW";
  /** Roll coefficient — maps to X axis (right = positive). */
  roll: number;
  /** Pitch coefficient — maps to Y axis (forward/up = positive). */
  pitch: number;
}

export interface FrameLayout {
  frameClass: number;
  className: string;
  frameType: number;
  typeName: string;
  motors: MotorPosition[];
}

// ── Frame Class Names ─────────────────────────────────────────

export const FRAME_CLASS_NAMES: Record<number, string> = {
  0: "Undefined",
  1: "Quad",
  2: "Hexa",
  3: "Octa",
  4: "OctaQuad",
  5: "Y6",
  6: "Heli (Single)",
  7: "Tri",
  8: "SingleCopter",
  9: "CoaxCopter",
  10: "BiCopter",
  11: "Heli (Dual)",
  12: "DodecaHexa",
  13: "HeliQuad",
  14: "Deca",
};

export const FRAME_TYPE_NAMES: Record<number, string> = {
  0: "Plus",
  1: "X",
  2: "V",
  3: "H",
  4: "VTail",
  5: "ATail",
  6: "PlusRev",
  10: "Y6B",
  11: "Y6F",
  12: "BetaFlightX",
  13: "DJI X",
  14: "ClockwiseX",
  15: "I",
  16: "NYT Plus",
  17: "NYT X",
  18: "X Reversed",
};

// ── Layout Data ───────────────────────────────────────────────

const LAYOUTS: FrameLayout[] = [
  // ── QUAD ────────────────────────────────────────────────
  {
    frameClass: 1, className: "Quad", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 2, rotation: "CCW", roll: -0.5, pitch: 0 },
      { number: 2, testOrder: 4, rotation: "CCW", roll: 0.5, pitch: 0 },
      { number: 3, testOrder: 1, rotation: "CW", roll: 0, pitch: 0.5 },
      { number: 4, testOrder: 3, rotation: "CW", roll: 0, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 1, typeName: "X",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 2, typeName: "V",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 3, typeName: "H",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 4, typeName: "VTail",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 12, typeName: "BetaFlightX",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 13, typeName: "DJI X",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CCW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.5 },
    ],
  },
  {
    frameClass: 1, className: "Quad", frameType: 14, typeName: "ClockwiseX",
    motors: [
      { number: 1, testOrder: 1, rotation: "CW", roll: -0.5, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CW", roll: 0.5, pitch: -0.5 },
      { number: 3, testOrder: 4, rotation: "CCW", roll: 0.5, pitch: 0.5 },
      { number: 4, testOrder: 2, rotation: "CCW", roll: -0.5, pitch: -0.5 },
    ],
  },

  // ── HEXA ────────────────────────────────────────────────
  {
    frameClass: 2, className: "Hexa", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: 0, pitch: 0.5 },
      { number: 2, testOrder: 4, rotation: "CW", roll: 0, pitch: -0.5 },
      { number: 3, testOrder: 5, rotation: "CCW", roll: -0.433, pitch: -0.25 },
      { number: 4, testOrder: 2, rotation: "CW", roll: 0.433, pitch: 0.25 },
      { number: 5, testOrder: 6, rotation: "CW", roll: -0.433, pitch: 0.25 },
      { number: 6, testOrder: 3, rotation: "CCW", roll: 0.433, pitch: -0.25 },
    ],
  },
  {
    frameClass: 2, className: "Hexa", frameType: 1, typeName: "X",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.289 },
      { number: 2, testOrder: 4, rotation: "CW", roll: 0.5, pitch: -0.289 },
      { number: 3, testOrder: 5, rotation: "CCW", roll: 0.5, pitch: 0.289 },
      { number: 4, testOrder: 2, rotation: "CW", roll: -0.5, pitch: -0.289 },
      { number: 5, testOrder: 6, rotation: "CW", roll: 0, pitch: 0.5 },
      { number: 6, testOrder: 3, rotation: "CCW", roll: 0, pitch: -0.5 },
    ],
  },

  // ── OCTA ────────────────────────────────────────────────
  {
    frameClass: 3, className: "Octa", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 1, rotation: "CW", roll: 0, pitch: 0.5 },
      { number: 2, testOrder: 3, rotation: "CW", roll: 0, pitch: -0.5 },
      { number: 3, testOrder: 2, rotation: "CCW", roll: -0.5, pitch: 0 },
      { number: 4, testOrder: 4, rotation: "CCW", roll: 0.5, pitch: 0 },
      { number: 5, testOrder: 5, rotation: "CCW", roll: -0.354, pitch: 0.354 },
      { number: 6, testOrder: 7, rotation: "CCW", roll: 0.354, pitch: -0.354 },
      { number: 7, testOrder: 6, rotation: "CW", roll: 0.354, pitch: 0.354 },
      { number: 8, testOrder: 8, rotation: "CW", roll: -0.354, pitch: -0.354 },
    ],
  },
  {
    frameClass: 3, className: "Octa", frameType: 1, typeName: "X",
    motors: [
      { number: 1, testOrder: 1, rotation: "CW", roll: -0.354, pitch: 0.354 },
      { number: 2, testOrder: 3, rotation: "CW", roll: 0.354, pitch: -0.354 },
      { number: 3, testOrder: 2, rotation: "CCW", roll: -0.354, pitch: -0.354 },
      { number: 4, testOrder: 4, rotation: "CCW", roll: 0.354, pitch: 0.354 },
      { number: 5, testOrder: 5, rotation: "CCW", roll: -0.5, pitch: 0 },
      { number: 6, testOrder: 7, rotation: "CCW", roll: 0.5, pitch: 0 },
      { number: 7, testOrder: 6, rotation: "CW", roll: 0, pitch: 0.5 },
      { number: 8, testOrder: 8, rotation: "CW", roll: 0, pitch: -0.5 },
    ],
  },

  // ── TRI ─────────────────────────────────────────────────
  {
    frameClass: 7, className: "Tri", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.289 },
      { number: 2, testOrder: 2, rotation: "CW", roll: 0.5, pitch: 0.289 },
      { number: 3, testOrder: 3, rotation: "CW", roll: 0, pitch: -0.5 },
      { number: 4, testOrder: 4, rotation: "CW", roll: 0, pitch: -0.5 }, // yaw servo
    ],
  },

  // ── Y6 ──────────────────────────────────────────────────
  {
    frameClass: 5, className: "Y6", frameType: 0, typeName: "Default",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: -0.5, pitch: 0.289 },
      { number: 2, testOrder: 2, rotation: "CW", roll: -0.5, pitch: 0.289 },
      { number: 3, testOrder: 3, rotation: "CW", roll: 0.5, pitch: 0.289 },
      { number: 4, testOrder: 4, rotation: "CCW", roll: 0.5, pitch: 0.289 },
      { number: 5, testOrder: 5, rotation: "CCW", roll: 0, pitch: -0.5 },
      { number: 6, testOrder: 6, rotation: "CW", roll: 0, pitch: -0.5 },
    ],
  },

  // ── DODECAHEXA ──────────────────────────────────────────
  {
    frameClass: 12, className: "DodecaHexa", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 1, rotation: "CW", roll: 0, pitch: 0.5 },
      { number: 2, testOrder: 2, rotation: "CCW", roll: 0, pitch: 0.5 },
      { number: 3, testOrder: 3, rotation: "CW", roll: 0, pitch: -0.5 },
      { number: 4, testOrder: 4, rotation: "CCW", roll: 0, pitch: -0.5 },
      { number: 5, testOrder: 5, rotation: "CW", roll: -0.433, pitch: -0.25 },
      { number: 6, testOrder: 6, rotation: "CCW", roll: -0.433, pitch: -0.25 },
      { number: 7, testOrder: 7, rotation: "CW", roll: 0.433, pitch: 0.25 },
      { number: 8, testOrder: 8, rotation: "CCW", roll: 0.433, pitch: 0.25 },
      { number: 9, testOrder: 9, rotation: "CW", roll: -0.433, pitch: 0.25 },
      { number: 10, testOrder: 10, rotation: "CCW", roll: -0.433, pitch: 0.25 },
      { number: 11, testOrder: 11, rotation: "CW", roll: 0.433, pitch: -0.25 },
      { number: 12, testOrder: 12, rotation: "CCW", roll: 0.433, pitch: -0.25 },
    ],
  },

  // ── DECA ────────────────────────────────────────────────
  {
    frameClass: 14, className: "Deca", frameType: 0, typeName: "Plus",
    motors: [
      { number: 1, testOrder: 1, rotation: "CCW", roll: 0, pitch: 0.5 },
      { number: 2, testOrder: 2, rotation: "CW", roll: 0, pitch: -0.5 },
      { number: 3, testOrder: 3, rotation: "CCW", roll: -0.476, pitch: 0.155 },
      { number: 4, testOrder: 4, rotation: "CW", roll: 0.476, pitch: -0.155 },
      { number: 5, testOrder: 5, rotation: "CCW", roll: -0.294, pitch: -0.405 },
      { number: 6, testOrder: 6, rotation: "CW", roll: 0.294, pitch: 0.405 },
      { number: 7, testOrder: 7, rotation: "CW", roll: -0.294, pitch: 0.405 },
      { number: 8, testOrder: 8, rotation: "CCW", roll: 0.294, pitch: -0.405 },
      { number: 9, testOrder: 9, rotation: "CW", roll: -0.476, pitch: -0.155 },
      { number: 10, testOrder: 10, rotation: "CCW", roll: 0.476, pitch: 0.155 },
    ],
  },
];

// ── Lookup ────────────────────────────────────────────────────

/** Key format: "class:type" e.g. "1:1" for Quad X. */
const layoutMap = new Map<string, FrameLayout>();
for (const layout of LAYOUTS) {
  layoutMap.set(`${layout.frameClass}:${layout.frameType}`, layout);
}

/**
 * Get motor layout for a frame class and type.
 * Falls back to type 0 (Plus) if specific type not found,
 * or null if frame class is entirely unknown.
 */
export function getMotorLayout(frameClass: number, frameType: number): FrameLayout | null {
  return layoutMap.get(`${frameClass}:${frameType}`)
    ?? layoutMap.get(`${frameClass}:0`)
    ?? null;
}

/** Get all available layouts. */
export function getAllLayouts(): FrameLayout[] {
  return LAYOUTS;
}
