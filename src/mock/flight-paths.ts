/**
 * GPS waypoint routes for demo drones.
 * Each path is a closed loop — drone cycles through waypoints continuously.
 */

export interface PathWaypoint {
  lat: number;
  lon: number;
  alt: number; // meters AGL
  speed: number; // m/s target ground speed
}

/**
 * Path 0: Alpha-1 — Security patrol loop.
 */
const PATROL_LOOP_A: PathWaypoint[] = [
  { lat: 0.005, lon: 0.003, alt: 40, speed: 8 },
  { lat: 0.007, lon: 0.005, alt: 45, speed: 8 },
  { lat: 0.009, lon: 0.007, alt: 40, speed: 8 },
  { lat: 0.008, lon: 0.010, alt: 45, speed: 8 },
  { lat: 0.006, lon: 0.011, alt: 40, speed: 8 },
  { lat: 0.004, lon: 0.009, alt: 45, speed: 8 },
  { lat: 0.003, lon: 0.006, alt: 40, speed: 8 },
  { lat: 0.004, lon: 0.004, alt: 45, speed: 8 },
];

/**
 * Path 1: Bravo-2 — Survey grid pattern.
 */
const SURVEY_GRID_A: PathWaypoint[] = [
  { lat: 0.010, lon: 0.010, alt: 80, speed: 5 },
  { lat: 0.012, lon: 0.010, alt: 80, speed: 5 },
  { lat: 0.012, lon: 0.013, alt: 80, speed: 5 },
  { lat: 0.010, lon: 0.013, alt: 80, speed: 5 },
  { lat: 0.010, lon: 0.016, alt: 80, speed: 5 },
  { lat: 0.012, lon: 0.016, alt: 80, speed: 5 },
  { lat: 0.012, lon: 0.019, alt: 80, speed: 5 },
  { lat: 0.010, lon: 0.019, alt: 80, speed: 5 },
  { lat: 0.008, lon: 0.019, alt: 80, speed: 5 },
  { lat: 0.008, lon: 0.016, alt: 80, speed: 5 },
  { lat: 0.008, lon: 0.013, alt: 80, speed: 5 },
  { lat: 0.008, lon: 0.010, alt: 80, speed: 5 },
];

/**
 * Path 2: Echo-5 — SAR search pattern.
 */
const SAR_SEARCH_A: PathWaypoint[] = [
  { lat: -0.005, lon: 0.020, alt: 60, speed: 10 },
  { lat: -0.003, lon: 0.023, alt: 65, speed: 10 },
  { lat: -0.001, lon: 0.020, alt: 60, speed: 10 },
  { lat: -0.003, lon: 0.017, alt: 65, speed: 10 },
  { lat: -0.005, lon: 0.014, alt: 60, speed: 10 },
  { lat: -0.007, lon: 0.017, alt: 65, speed: 10 },
  { lat: -0.007, lon: 0.023, alt: 60, speed: 10 },
  { lat: -0.005, lon: 0.026, alt: 65, speed: 10 },
];

export const FLIGHT_PATHS: PathWaypoint[][] = [
  PATROL_LOOP_A,
  SURVEY_GRID_A,
  SAR_SEARCH_A,
];

/**
 * Interpolate position between two waypoints.
 * Returns { lat, lon, alt, heading, progress (0-1) }.
 */
export function interpolatePath(
  from: PathWaypoint,
  to: PathWaypoint,
  t: number
): { lat: number; lon: number; alt: number; heading: number } {
  const lat = from.lat + (to.lat - from.lat) * t;
  const lon = from.lon + (to.lon - from.lon) * t;
  const alt = from.alt + (to.alt - from.alt) * t;

  // Calculate heading
  const dLon = to.lon - from.lon;
  const y = Math.sin(dLon * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180));
  const x =
    Math.cos(from.lat * (Math.PI / 180)) * Math.sin(to.lat * (Math.PI / 180)) -
    Math.sin(from.lat * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180)) * Math.cos(dLon * (Math.PI / 180));
  const heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { lat, lon, alt, heading };
}
