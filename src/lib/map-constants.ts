/**
 * @module map-constants
 * @description Shared constants for map-related components in the mission planner.
 * @license GPL-3.0-only
 */

/** Default map center: Bangalore, India. */
export const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

/** Design-system color tokens used across map components. */
export const MAP_COLORS = {
  /** Primary accent — waypoint fill, path stroke, chart stroke. */
  accentPrimary: "#3a82ff",
  /** Secondary accent — selected waypoint fill. */
  accentSelected: "#dff140",
  /** Light foreground — unselected waypoint stroke, dot fill. */
  foreground: "#fafafa",
  /** Dark background — selected waypoint text. */
  background: "#0a0a0f",
  /** Muted text — segment labels. */
  muted: "#9ca3af",
  /** Geofence / danger boundary — red. */
  fence: "#ef4444",
  /** Rally point — orange. */
  rally: "#f97316",
} as const;
