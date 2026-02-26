import type { FleetDrone, DroneStatus, FlightMode, SuiteType } from "@/lib/types";

export interface DemoDroneConfig {
  id: string;
  name: string;
  status: DroneStatus;
  flightMode: FlightMode;
  suiteType?: SuiteType;
  suiteName?: string;
  homeLat: number;
  homeLon: number;
  homeAlt: number;
  batteryStart: number;
  pathIndex: number; // index into FLIGHT_PATHS
  healthScore: number;
}

/**
 * 5 demo drones in Bangalore area.
 */
export const DEMO_DRONES: DemoDroneConfig[] = [
  {
    id: "alpha-1",
    name: "Alpha-1",
    status: "in_mission",
    flightMode: "AUTO",
    suiteType: "sentry",
    suiteName: "Sentry — Security Patrol",
    homeLat: 12.9766,
    homeLon: 77.5993,
    homeAlt: 0,
    batteryStart: 82,
    pathIndex: 0,
    healthScore: 95,
  },
  {
    id: "bravo-2",
    name: "Bravo-2",
    status: "in_mission",
    flightMode: "AUTO",
    suiteType: "survey",
    suiteName: "Survey — Area Mapping",
    homeLat: 12.9836,
    homeLon: 77.6094,
    homeAlt: 0,
    batteryStart: 67,
    pathIndex: 1,
    healthScore: 88,
  },
  {
    id: "echo-5",
    name: "Echo-5",
    status: "in_mission",
    flightMode: "GUIDED",
    suiteType: "sar",
    suiteName: "SAR — Search & Rescue",
    homeLat: 12.9698,
    homeLon: 77.7500,
    homeAlt: 0,
    batteryStart: 91,
    pathIndex: 2,
    healthScore: 92,
  },
  {
    id: "charlie",
    name: "Charlie",
    status: "idle",
    flightMode: "STABILIZE",
    homeLat: 12.8461,
    homeLon: 77.6602,
    homeAlt: 0,
    batteryStart: 100,
    pathIndex: -1, // grounded
    healthScore: 78,
  },
  {
    id: "delta",
    name: "Delta",
    status: "maintenance",
    flightMode: "STABILIZE",
    homeLat: 12.9352,
    homeLon: 77.6245,
    homeAlt: 0,
    batteryStart: 45,
    pathIndex: -1, // offline
    healthScore: 42,
  },
];

/** Convert config to initial FleetDrone state. */
export function configToFleetDrone(cfg: DemoDroneConfig): FleetDrone {
  return {
    id: cfg.id,
    name: cfg.name,
    status: cfg.status,
    suiteName: cfg.suiteName,
    suiteType: cfg.suiteType,
    connectionState: cfg.status === "maintenance" ? "disconnected" : "connected",
    flightMode: cfg.flightMode,
    armState: cfg.status === "in_mission" ? "armed" : "disarmed",
    lastHeartbeat: 1740600000000,
    healthScore: cfg.healthScore,
    position: {
      timestamp: 1740600000000,
      lat: cfg.homeLat,
      lon: cfg.homeLon,
      alt: cfg.status === "in_mission" ? 50 : 0,
      relativeAlt: cfg.status === "in_mission" ? 50 : 0,
      heading: 0,
      groundSpeed: 0,
      airSpeed: 0,
      climbRate: 0,
    },
    battery: {
      timestamp: 1740600000000,
      voltage: 22.2 * (cfg.batteryStart / 100),
      current: cfg.status === "in_mission" ? 12.5 : 0,
      remaining: cfg.batteryStart,
      consumed: (100 - cfg.batteryStart) * 22,
    },
    gps: {
      timestamp: 1740600000000,
      fixType: cfg.status === "maintenance" ? 0 : 3,
      satellites: cfg.status === "maintenance" ? 0 : 17,
      hdop: 1.0,
      lat: cfg.homeLat,
      lon: cfg.homeLon,
      alt: 920 + cfg.homeLat * 10, // approx Bangalore MSL
    },
  };
}
