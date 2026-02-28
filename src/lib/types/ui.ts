/**
 * UI, view, flight history, and analytics types.
 * @module types/ui
 */

import type { SuiteType } from './mission';

// ── UI ───────────────────────────────────────────────────────

export type ViewId =
  | "dashboard"
  | "plan"
  | "simulate"
  | "history"
  | "analytics"
  | "config"
  | "wizard";

export interface PanelState {
  telemetry: boolean;
  alerts: boolean;
  chat: boolean;
}

// ── Flight History ───────────────────────────────────────────

export interface FlightRecord {
  id: string;
  droneId: string;
  droneName: string;
  suiteType?: SuiteType;
  date: number;          // timestamp
  duration: number;       // seconds
  distance: number;       // meters
  maxAlt: number;         // meters
  maxSpeed: number;       // m/s
  batteryUsed: number;    // percentage
  waypointCount: number;
  status: "completed" | "aborted" | "emergency";
  path?: [number, number][]; // [lat, lon][]
}

// ── Analytics ────────────────────────────────────────────────

export interface AnalyticsData {
  totalFlights: number;
  totalFlightTime: number;    // seconds
  totalDistance: number;       // meters
  avgFlightTime: number;       // seconds
  avgBatteryUsed: number;      // percentage
  missionSuccessRate: number;  // percentage
  flightsPerDay: { date: string; count: number }[];
  utilizationByDrone: { droneId: string; droneName: string; hours: number }[];
  batteryDegradation: { date: string; avgCapacity: number }[];
}
