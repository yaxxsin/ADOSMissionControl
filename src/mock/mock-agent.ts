/**
 * @module MockAgentClient
 * @description Mock implementation of AgentClient for demo mode.
 * @license GPL-3.0-only
 */

import type {
  AgentStatus,
  ServiceInfo,
  SystemResources,
  LogEntry,
  CommandResult,
} from "@/lib/agent/types";

const jitter = (base: number, range: number) =>
  base + (Math.random() - 0.5) * 2 * range;

const startTime = Date.now();

// ── Mock Sensors ────────────────────────────────────────────

export interface MockSensor {
  name: string;
  type: string;
  bus: string;
  address: string;
  rate_hz: number;
  status: "ok" | "warning" | "error";
  last_reading: string;
}

export const MOCK_SENSORS: MockSensor[] = [
  { name: "BME280", type: "barometer", bus: "I2C-1", address: "0x76", rate_hz: 50, status: "ok", last_reading: "101325 Pa / 24.3C" },
  { name: "MPU6050", type: "imu", bus: "I2C-1", address: "0x68", rate_hz: 1000, status: "ok", last_reading: "ax=0.02 ay=-0.01 az=9.81" },
  { name: "BN-880", type: "gps", bus: "UART-2", address: "115200", rate_hz: 10, status: "ok", last_reading: "3D Fix, 17 sats, HDOP 0.8" },
  { name: "TFMini-S", type: "rangefinder", bus: "UART-3", address: "115200", rate_hz: 100, status: "ok", last_reading: "2.34 m" },
  { name: "PMW3901", type: "optical_flow", bus: "SPI-0", address: "CS0", rate_hz: 80, status: "warning", last_reading: "dx=12 dy=-3 quality=142" },
];

// ── Mock Modules ────────────────────────────────────────────

export interface MockModule {
  name: string;
  version: string;
  installed: boolean;
  description: string;
}

export const MOCK_MODULES: MockModule[] = [
  { name: "mavlink-proxy", version: "1.0.0", installed: true, description: "MAVLink message forwarding and multiplexing" },
  { name: "video-pipeline", version: "1.0.0", installed: true, description: "WFB-ng video stream management" },
  { name: "mqtt-gateway", version: "1.0.0", installed: true, description: "MQTT telemetry bridge to cloud" },
  { name: "suite-runtime", version: "1.0.0", installed: true, description: "Suite YAML manifest loader and executor" },
  { name: "script-executor", version: "1.0.0", installed: true, description: "Python and text command execution engine" },
  { name: "sensor-manager", version: "1.0.0", installed: true, description: "Sensor discovery, configuration, and data routing" },
  { name: "obstacle-avoidance", version: "0.9.0", installed: false, description: "Depth camera obstacle detection and path replanning" },
  { name: "precision-landing", version: "0.8.0", installed: false, description: "ArUco marker and IR beacon precision landing" },
  { name: "swarm-coordinator", version: "0.7.0", installed: false, description: "Multi-drone formation and task distribution" },
];

// ── Mock Network ────────────────────────────────────────────

export interface MockNetworkPeer {
  id: string;
  name: string;
  signal_dbm: number;
  last_seen: string;
}

export interface MockNetwork {
  mqtt: { connected: boolean; broker: string; messages_sent: number; messages_received: number };
  mesh: { lora: { installed: boolean }; wifi_direct: { enabled: boolean } };
  peers: MockNetworkPeer[];
}

export const MOCK_NETWORK: MockNetwork = {
  mqtt: { connected: true, broker: "mqtt://fleet.altnautica.com:8883", messages_sent: 14832, messages_received: 9217 },
  mesh: { lora: { installed: false }, wifi_direct: { enabled: false } },
  peers: [
    { id: "bravo-2", name: "Bravo-2", signal_dbm: -62, last_seen: "2s ago" },
    { id: "echo-5", name: "Echo-5", signal_dbm: -78, last_seen: "5s ago" },
  ],
};

// ── Mock Logs ───────────────────────────────────────────────

function generateMockLogs(): LogEntry[] {
  const now = new Date();
  const entries: LogEntry[] = [];
  const bootMessages: [string, string, LogEntry["level"]][] = [
    ["agent", "ADOS Drone Agent v0.1.0 starting", "info"],
    ["agent", "Board: Raspberry Pi CM4 (4GB)", "info"],
    ["agent", "OS: Raspberry Pi OS Lite (Bookworm)", "info"],
    ["mavlink-proxy", "Connecting to FC on /dev/ttyAMA0 @ 921600", "info"],
    ["mavlink-proxy", "Heartbeat received: ArduCopter 4.5.7", "info"],
    ["mavlink-proxy", "Parameter sync complete: 1042 params", "info"],
    ["video-pipeline", "WFB-ng initializing on wlan1", "info"],
    ["video-pipeline", "TX power: 29 dBm, channel: 165 (5825 MHz)", "info"],
    ["video-pipeline", "Video pipeline active: 1280x720@30fps H.264", "info"],
    ["mqtt-gateway", "Connecting to mqtt://fleet.altnautica.com:8883", "info"],
    ["mqtt-gateway", "TLS handshake complete, authenticated", "info"],
    ["mqtt-gateway", "Subscribed to fleet/alpha-1/cmd/#", "info"],
    ["suite-runtime", "Loading suite: Sentry — Security Patrol", "info"],
    ["suite-runtime", "Suite manifest validated, 3 sensors required", "info"],
    ["sensor-manager", "Discovered 5 sensors on I2C-1, UART-2, UART-3, SPI-0", "info"],
    ["sensor-manager", "BME280 barometer OK @ 50 Hz", "info"],
    ["sensor-manager", "MPU6050 IMU OK @ 1000 Hz", "info"],
    ["sensor-manager", "BN-880 GPS OK @ 10 Hz, 3D fix", "info"],
    ["sensor-manager", "TFMini-S rangefinder OK @ 100 Hz", "info"],
    ["sensor-manager", "PMW3901 optical flow — quality low (142/255)", "warning"],
    ["script-executor", "Command interface ready on :8080", "info"],
    ["agent", "All services started, uptime monitoring active", "info"],
    ["mavlink-proxy", "Mode changed: STABILIZE -> AUTO", "info"],
    ["mavlink-proxy", "Vehicle armed", "info"],
    ["suite-runtime", "Mission started: patrol_grid_01", "info"],
    ["mqtt-gateway", "Telemetry publishing at 2 Hz", "info"],
    ["sensor-manager", "Rangefinder AGL: 50.2 m", "info"],
    ["video-pipeline", "Stream bitrate: 4.2 Mbps, latency: 42ms", "info"],
    ["mavlink-proxy", "Waypoint 3/12 reached", "info"],
    ["suite-runtime", "Sentry alert: motion detected sector B-4", "warning"],
    ["mqtt-gateway", "Alert published to fleet/alpha-1/alerts", "info"],
    ["agent", "System temp: 45.2C (normal)", "info"],
    ["agent", "CPU: 34%, RAM: 1.2 GB / 4.0 GB", "info"],
    ["mavlink-proxy", "Waypoint 6/12 reached", "info"],
    ["video-pipeline", "Recording: 00:14:32, 3.8 GB", "info"],
    ["sensor-manager", "PMW3901 quality improved (198/255)", "info"],
    ["mavlink-proxy", "Waypoint 9/12 reached", "info"],
    ["mqtt-gateway", "Messages sent: 14832, received: 9217", "info"],
    ["agent", "Battery: 82%, estimated remaining: 18 min", "info"],
  ];

  bootMessages.forEach(([service, message, level], i) => {
    const ts = new Date(now.getTime() - (bootMessages.length - i) * 2000);
    entries.push({ timestamp: ts.toISOString(), level, service, message });
  });

  return entries;
}

const cachedLogs = generateMockLogs();

// ── Command Lookup ──────────────────────────────────────────

const commandResponses: Record<string, CommandResult> = {
  arm: { success: true, message: "Vehicle armed" },
  disarm: { success: true, message: "Vehicle disarmed" },
  takeoff: { success: true, message: "Takeoff initiated to 10m" },
  land: { success: true, message: "Landing initiated" },
  rtl: { success: true, message: "Return to launch initiated" },
  mode: { success: true, message: "Flight mode changed" },
  status: { success: true, message: "Agent running, FC connected, 5 services active" },
  help: { success: true, message: "Commands: arm, disarm, takeoff [alt], land, rtl, mode [name], status, help" },
};

// ── MockAgentClient ─────────────────────────────────────────

export class MockAgentClient {
  async getStatus(): Promise<AgentStatus> {
    await delay(60);
    const uptimeMs = Date.now() - startTime;
    return {
      version: "0.1.0",
      uptime_seconds: Math.floor(uptimeMs / 1000),
      device_id: "ados-alpha-1-cm4",
      name: "ADOS Agent (Alpha-1)",
      tier: 3,
      board: "Raspberry Pi CM4",
      os: "Raspberry Pi OS Lite",
      fc_connected: true,
      fc_port: "/dev/ttyAMA0",
      fc_baud: 921600,
      armed: true,
      mode: "AUTO",
      gps_fix: 3,
      satellites: 17,
    };
  }

  async getServices(): Promise<ServiceInfo[]> {
    await delay(80);
    return [
      { name: "mavlink-proxy", status: "running", pid: 1201, cpu_percent: jitter(8, 3), memory_mb: jitter(45, 5), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
      { name: "video-pipeline", status: "running", pid: 1202, cpu_percent: jitter(22, 5), memory_mb: jitter(120, 10), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
      { name: "mqtt-gateway", status: "running", pid: 1203, cpu_percent: jitter(3, 1.5), memory_mb: jitter(28, 4), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
      { name: "suite-runtime", status: "running", pid: 1204, cpu_percent: jitter(5, 2), memory_mb: jitter(64, 8), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
      { name: "script-executor", status: "running", pid: 1205, cpu_percent: jitter(1, 0.5), memory_mb: jitter(18, 3), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
      { name: "sensor-manager", status: "running", pid: 1206, cpu_percent: jitter(6, 2), memory_mb: jitter(35, 5), uptime_seconds: Math.floor((Date.now() - startTime) / 1000) },
    ];
  }

  async getSystemResources(): Promise<SystemResources> {
    await delay(50);
    return {
      cpu_percent: jitter(34, 8),
      memory_percent: jitter(31, 4),
      memory_used_mb: jitter(1240, 80),
      memory_total_mb: 4096,
      disk_percent: jitter(42, 2),
      disk_used_gb: jitter(13.5, 0.5),
      disk_total_gb: 32,
      temperature: jitter(45, 3),
    };
  }

  async getLogs(params?: { level?: string; limit?: number }): Promise<LogEntry[]> {
    await delay(40);
    let logs = cachedLogs;
    if (params?.level) {
      logs = logs.filter((l) => l.level === params.level);
    }
    if (params?.limit) {
      logs = logs.slice(-params.limit);
    }
    return logs;
  }

  async sendCommand(cmd: string): Promise<CommandResult> {
    await delay(100);
    const key = cmd.toLowerCase().split(/\s+/)[0];
    return commandResponses[key] ?? { success: false, message: `Unknown command: ${cmd}` };
  }

  async restartService(name: string): Promise<CommandResult> {
    await delay(300);
    return { success: true, message: `Service '${name}' restarted` };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
