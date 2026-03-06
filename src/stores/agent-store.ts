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
} from "@/lib/agent/types";

interface AgentStore {
  agentUrl: string | null;
  connected: boolean;
  client: AgentClient | null;
  connectionError: string | null;

  status: AgentStatus | null;
  services: ServiceInfo[];
  resources: SystemResources | null;
  logs: LogEntry[];

  pollInterval: ReturnType<typeof setInterval> | null;

  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  fetchStatus: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchLogs: (level?: string) => Promise<void>;
  restartService: (name: string) => Promise<void>;
  sendCommand: (cmd: string, args?: unknown[]) => Promise<CommandResult | null>;
  startPolling: () => void;
  stopPolling: () => void;
  clear: () => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentUrl: null,
  connected: false,
  client: null,
  connectionError: null,

  status: null,
  services: [],
  resources: null,
  logs: [],

  pollInterval: null,

  async connect(url: string) {
    let client: AgentClient;
    if (url === "mock://demo") {
      const { MockAgentClient } = await import("@/mock/mock-agent");
      client = new MockAgentClient() as unknown as AgentClient;
    } else {
      client = new AgentClient(url);
    }
    set({ agentUrl: url, client, connectionError: null });
    try {
      const status = await client.getStatus();
      set({ connected: true, status });
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
      connectionError: null,
      status: null,
      services: [],
      resources: null,
      logs: [],
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
      set({ resources });
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
}));
