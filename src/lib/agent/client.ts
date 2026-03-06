/**
 * @module AgentClient
 * @description REST API client for communicating with the ADOS Drone Agent.
 * @license GPL-3.0-only
 */

import type {
  AgentStatus,
  TelemetrySnapshot,
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
} from "./types";

export class AgentClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`Agent API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async getStatus(): Promise<AgentStatus> {
    return this.request<AgentStatus>("/api/v1/status");
  }

  async getTelemetry(): Promise<TelemetrySnapshot> {
    return this.request<TelemetrySnapshot>("/api/v1/telemetry");
  }

  async getServices(): Promise<ServiceInfo[]> {
    return this.request<ServiceInfo[]>("/api/v1/services");
  }

  async getSystemResources(): Promise<SystemResources> {
    return this.request<SystemResources>("/api/v1/system");
  }

  async getLogs(params?: { level?: string; limit?: number }): Promise<LogEntry[]> {
    const qs = new URLSearchParams();
    if (params?.level) qs.set("level", params.level);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return this.request<LogEntry[]>(`/api/v1/logs${query ? `?${query}` : ""}`);
  }

  async getParams(): Promise<Record<string, number>> {
    return this.request<Record<string, number>>("/api/v1/params");
  }

  async sendCommand(cmd: string, args?: unknown[]): Promise<CommandResult> {
    return this.request<CommandResult>("/api/v1/command", {
      method: "POST",
      body: JSON.stringify({ command: cmd, args: args ?? [] }),
    });
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/config");
  }

  async restartService(name: string): Promise<CommandResult> {
    return this.request<CommandResult>(`/api/v1/services/${encodeURIComponent(name)}/restart`, {
      method: "POST",
    });
  }

  // ── Peripherals ─────────────────────────────────────────

  async getPeripherals(): Promise<PeripheralInfo[]> {
    return this.request<PeripheralInfo[]>("/api/v1/peripherals");
  }

  async scanPeripherals(): Promise<PeripheralInfo[]> {
    return this.request<PeripheralInfo[]>("/api/v1/peripherals/scan", { method: "POST" });
  }

  // ── Scripts ─────────────────────────────────────────────

  async getScripts(): Promise<ScriptInfo[]> {
    return this.request<ScriptInfo[]>("/api/v1/scripts");
  }

  async saveScript(name: string, content: string, suite?: string): Promise<ScriptInfo> {
    return this.request<ScriptInfo>("/api/v1/scripts", {
      method: "POST",
      body: JSON.stringify({ name, content, suite }),
    });
  }

  async deleteScript(id: string): Promise<CommandResult> {
    return this.request<CommandResult>(`/api/v1/scripts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async runScript(id: string): Promise<ScriptRunResult> {
    return this.request<ScriptRunResult>(`/api/v1/scripts/${encodeURIComponent(id)}/run`, {
      method: "POST",
    });
  }

  // ── Suites ──────────────────────────────────────────────

  async getSuites(): Promise<SuiteInfo[]> {
    return this.request<SuiteInfo[]>("/api/v1/suites");
  }

  async installSuite(id: string): Promise<CommandResult> {
    return this.request<CommandResult>(`/api/v1/suites/${encodeURIComponent(id)}/install`, {
      method: "POST",
    });
  }

  async uninstallSuite(id: string): Promise<CommandResult> {
    return this.request<CommandResult>(`/api/v1/suites/${encodeURIComponent(id)}/uninstall`, {
      method: "POST",
    });
  }

  async activateSuite(id: string): Promise<CommandResult> {
    return this.request<CommandResult>(`/api/v1/suites/${encodeURIComponent(id)}/activate`, {
      method: "POST",
    });
  }

  // ── Fleet ───────────────────────────────────────────────

  async getEnrollment(): Promise<DroneNetEnrollment> {
    return this.request<DroneNetEnrollment>("/api/v1/fleet/enrollment");
  }

  async getPeers(): Promise<NetworkPeer[]> {
    return this.request<NetworkPeer[]>("/api/v1/fleet/peers");
  }
}
