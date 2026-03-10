/**
 * @module AgentStore
 * @description Zustand store for ADOS Drone Agent connection and state.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { AgentClient } from "@/lib/agent/client";
import type {
  AgentStatus,
  ServiceInfo,
  SystemResources,
  LogEntry,
  CommandResult,
  PeripheralInfo,
  ScriptInfo,
  ScriptRunResult,
  SuiteInfo,
  DroneNetEnrollment,
  NetworkPeer,
} from "@/lib/agent/types";

interface AgentStore {
  agentUrl: string | null;
  apiKey: string | null;
  connected: boolean;
  client: AgentClient | null;
  connectionError: string | null;

  status: AgentStatus | null;
  services: ServiceInfo[];
  resources: SystemResources | null;
  logs: LogEntry[];

  peripherals: PeripheralInfo[];
  scripts: ScriptInfo[];
  suites: SuiteInfo[];
  enrollment: DroneNetEnrollment | null;
  peers: NetworkPeer[];
  cpuHistory: number[];
  scriptOutput: ScriptRunResult | null;
  runningScript: string | null;

  pollInterval: ReturnType<typeof setInterval> | null;

  connect: (url: string, apiKey?: string | null) => Promise<void>;
  disconnect: () => void;
  setApiKey: (key: string | null) => void;
  fetchStatus: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchLogs: (level?: string) => Promise<void>;
  restartService: (name: string) => Promise<void>;
  sendCommand: (cmd: string, args?: unknown[]) => Promise<CommandResult | null>;
  startPolling: () => void;
  stopPolling: () => void;
  clear: () => void;

  fetchPeripherals: () => Promise<void>;
  scanPeripherals: () => Promise<void>;
  fetchScripts: () => Promise<void>;
  saveScript: (name: string, content: string, suite?: string) => Promise<ScriptInfo | null>;
  deleteScript: (id: string) => Promise<void>;
  runScript: (id: string) => Promise<void>;
  fetchSuites: () => Promise<void>;
  installSuite: (id: string) => Promise<void>;
  uninstallSuite: (id: string) => Promise<void>;
  activateSuite: (id: string) => Promise<void>;
  fetchEnrollment: () => Promise<void>;
  fetchPeers: () => Promise<void>;
}

const MAX_CPU_HISTORY = 60;

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentUrl: null,
  apiKey: null,
  connected: false,
  client: null,
  connectionError: null,

  status: null,
  services: [],
  resources: null,
  logs: [],

  peripherals: [],
  scripts: [],
  suites: [],
  enrollment: null,
  peers: [],
  cpuHistory: [],
  scriptOutput: null,
  runningScript: null,

  pollInterval: null,

  setApiKey(key: string | null) {
    set({ apiKey: key });
  },

  async connect(url: string, apiKey?: string | null) {
    let client: AgentClient;
    const resolvedKey = apiKey ?? get().apiKey;
    if (url === "mock://demo") {
      const { MockAgentClient } = await import("@/mock/mock-agent");
      client = new MockAgentClient() as unknown as AgentClient;
    } else {
      client = new AgentClient(url, resolvedKey);
    }
    set({ agentUrl: url, apiKey: resolvedKey, client, connectionError: null });
    try {
      const status = await client.getStatus();
      set({ connected: true, status });
      // Fetch initial data immediately so tabs aren't empty for 3s
      get().fetchServices();
      get().fetchResources();
      get().fetchLogs();
      get().startPolling();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      set({ connected: false, connectionError: msg, client: null, agentUrl: null });
    }
  },

  disconnect() {
    get().stopPolling();
    set({
      connected: false,
      client: null,
      agentUrl: null,
      apiKey: null,
      connectionError: null,
      status: null,
      services: [],
      resources: null,
      logs: [],
      peripherals: [],
      scripts: [],
      suites: [],
      enrollment: null,
      peers: [],
      cpuHistory: [],
      scriptOutput: null,
      runningScript: null,
    });
  },

  async fetchStatus() {
    const { client } = get();
    if (!client) return;
    try {
      const status = await client.getStatus();
      set({ status });
    } catch {
      set({ connected: false, connectionError: "Lost connection to agent" });
      get().stopPolling();
    }
  },

  async fetchServices() {
    const { client } = get();
    if (!client) return;
    try {
      const services = await client.getServices();
      set({ services });
    } catch { /* silent */ }
  },

  async fetchResources() {
    const { client } = get();
    if (!client) return;
    try {
      const resources = await client.getSystemResources();
      set((state) => {
        const cpuHistory = [...state.cpuHistory, resources.cpu_percent];
        if (cpuHistory.length > MAX_CPU_HISTORY) cpuHistory.shift();
        return { resources, cpuHistory };
      });
    } catch { /* silent */ }
  },

  async fetchLogs(level?: string) {
    const { client } = get();
    if (!client) return;
    try {
      const logs = await client.getLogs({ level, limit: 200 });
      set({ logs });
    } catch { /* silent */ }
  },

  async restartService(name: string) {
    const { client } = get();
    if (!client) return;
    try {
      await client.restartService(name);
      await get().fetchServices();
    } catch { /* silent */ }
  },

  async sendCommand(cmd: string, args?: unknown[]) {
    const { client } = get();
    if (!client) return null;
    try {
      return await client.sendCommand(cmd, args);
    } catch {
      return null;
    }
  },

  startPolling() {
    get().stopPolling();
    const interval = setInterval(() => {
      get().fetchStatus();
      get().fetchServices();
      get().fetchResources();
    }, 3000);
    set({ pollInterval: interval });
  },

  stopPolling() {
    const { pollInterval } = get();
    if (pollInterval) {
      clearInterval(pollInterval);
      set({ pollInterval: null });
    }
  },

  clear() {
    get().disconnect();
  },

  // ── Peripherals ─────────────────────────────────────────

  async fetchPeripherals() {
    const { client } = get();
    if (!client) return;
    try {
      const peripherals = await client.getPeripherals();
      set({ peripherals });
    } catch { /* silent */ }
  },

  async scanPeripherals() {
    const { client } = get();
    if (!client) return;
    try {
      const peripherals = await client.scanPeripherals();
      set({ peripherals });
    } catch { /* silent */ }
  },

  // ── Scripts ─────────────────────────────────────────────

  async fetchScripts() {
    const { client } = get();
    if (!client) return;
    try {
      const scripts = await client.getScripts();
      set({ scripts });
    } catch { /* silent */ }
  },

  async saveScript(name: string, content: string, suite?: string) {
    const { client } = get();
    if (!client) return null;
    try {
      const script = await client.saveScript(name, content, suite);
      await get().fetchScripts();
      return script;
    } catch {
      return null;
    }
  },

  async deleteScript(id: string) {
    const { client } = get();
    if (!client) return;
    try {
      await client.deleteScript(id);
      await get().fetchScripts();
    } catch { /* silent */ }
  },

  async runScript(id: string) {
    const { client } = get();
    if (!client) return;
    set({ runningScript: id, scriptOutput: null });
    try {
      const result = await client.runScript(id);
      set({ scriptOutput: result, runningScript: null });
    } catch {
      set({
        scriptOutput: { stdout: "", stderr: "Failed to execute script", exitCode: 1, durationMs: 0 },
        runningScript: null,
      });
    }
  },

  // ── Suites ──────────────────────────────────────────────

  async fetchSuites() {
    const { client } = get();
    if (!client) return;
    try {
      const suites = await client.getSuites();
      set({ suites });
    } catch { /* silent */ }
  },

  async installSuite(id: string) {
    const { client } = get();
    if (!client) return;
    try {
      await client.installSuite(id);
      await get().fetchSuites();
    } catch { /* silent */ }
  },

  async uninstallSuite(id: string) {
    const { client } = get();
    if (!client) return;
    try {
      await client.uninstallSuite(id);
      await get().fetchSuites();
    } catch { /* silent */ }
  },

  async activateSuite(id: string) {
    const { client } = get();
    if (!client) return;
    try {
      await client.activateSuite(id);
      await get().fetchSuites();
    } catch { /* silent */ }
  },

  // ── Fleet ───────────────────────────────────────────────

  async fetchEnrollment() {
    const { client } = get();
    if (!client) return;
    try {
      const enrollment = await client.getEnrollment();
      set({ enrollment });
    } catch { /* silent */ }
  },

  async fetchPeers() {
    const { client } = get();
    if (!client) return;
    try {
      const peers = await client.getPeers();
      set({ peers });
    } catch { /* silent */ }
  },
}));
