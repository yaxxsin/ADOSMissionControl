/**
 * Telemetry recording system.
 *
 * Captures all telemetry data with timestamps to IndexedDB for
 * later replay, export, and analysis. Start/stop recording from
 * the UI header. Recordings persist across sessions.
 *
 * @module telemetry-recorder
 * @license GPL-3.0-only
 */

import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from "idb-keyval";

// ── Types ────────────────────────────────────────────────────

export interface TelemetryFrame {
  /** Milliseconds since recording start. */
  offsetMs: number;
  /** Channel name (attitude, position, battery, etc.). */
  channel: string;
  /** The telemetry data object. */
  data: unknown;
}

export interface TelemetryRecording {
  id: string;
  /** Human-readable name. */
  name: string;
  /** Recording start timestamp (ms since epoch). */
  startTime: number;
  /** Recording end timestamp (ms since epoch). */
  endTime: number;
  /** Duration in ms. */
  durationMs: number;
  /** Total frame count. */
  frameCount: number;
  /** Channels captured. */
  channels: string[];
  /** Drone ID, if known. */
  droneId?: string;
  /** Drone name, if known. */
  droneName?: string;
}

// ── IDB Keys ─────────────────────────────────────────────────

const IDB_RECORDINGS_PREFIX = "altcmd:recording:";
const IDB_RECORDINGS_INDEX = "altcmd:recordings-index";

// ── Recorder Class ───────────────────────────────────────────

type RecordingState = "idle" | "recording" | "error";

/** Singleton-style recording state. */
let _state: RecordingState = "idle";
let _startTime = 0;
let _frames: TelemetryFrame[] = [];
let _channels = new Set<string>();
let _recordingId = "";
let _droneId: string | undefined;
let _droneName: string | undefined;

// Max frames per recording to prevent memory issues
const MAX_FRAMES = 500_000; // ~8 min at full rate

/**
 * Start a new telemetry recording.
 */
export function startRecording(droneId?: string, droneName?: string): string {
  if (_state === "recording") {
    throw new Error("Already recording — stop current recording first");
  }

  _recordingId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  _startTime = Date.now();
  _frames = [];
  _channels = new Set();
  _droneId = droneId;
  _droneName = droneName;
  _state = "recording";

  return _recordingId;
}

/**
 * Record a single telemetry frame. Call this from telemetry bridges.
 * Noop if not recording.
 */
export function recordFrame(channel: string, data: unknown): void {
  if (_state !== "recording") return;
  if (_frames.length >= MAX_FRAMES) return; // silently cap

  _channels.add(channel);
  _frames.push({
    offsetMs: Date.now() - _startTime,
    channel,
    data,
  });
}

/**
 * Stop the current recording and persist to IndexedDB.
 * Returns the recording metadata.
 */
export async function stopRecording(): Promise<TelemetryRecording | null> {
  if (_state !== "recording") return null;

  const endTime = Date.now();
  const recording: TelemetryRecording = {
    id: _recordingId,
    name: `Recording ${new Date(_startTime).toLocaleString()}`,
    startTime: _startTime,
    endTime,
    durationMs: endTime - _startTime,
    frameCount: _frames.length,
    channels: Array.from(_channels),
    droneId: _droneId,
    droneName: _droneName,
  };

  // Store frames
  await idbSet(`${IDB_RECORDINGS_PREFIX}${_recordingId}`, _frames);

  // Update index
  const index: TelemetryRecording[] = (await idbGet(IDB_RECORDINGS_INDEX)) ?? [];
  index.push(recording);
  // Keep last 20 recordings
  while (index.length > 20) {
    const oldest = index.shift()!;
    await idbDel(`${IDB_RECORDINGS_PREFIX}${oldest.id}`);
  }
  await idbSet(IDB_RECORDINGS_INDEX, index);

  // Reset state
  _state = "idle";
  _frames = [];
  _channels = new Set();

  return recording;
}

/**
 * Get recording state.
 */
export function getRecordingState(): {
  state: RecordingState;
  durationMs: number;
  frameCount: number;
} {
  return {
    state: _state,
    durationMs: _state === "recording" ? Date.now() - _startTime : 0,
    frameCount: _frames.length,
  };
}

/**
 * List all saved recordings.
 */
export async function listRecordings(): Promise<TelemetryRecording[]> {
  return (await idbGet(IDB_RECORDINGS_INDEX)) ?? [];
}

/**
 * Load frames for a recording.
 */
export async function loadRecordingFrames(recordingId: string): Promise<TelemetryFrame[]> {
  return (await idbGet(`${IDB_RECORDINGS_PREFIX}${recordingId}`)) ?? [];
}

/**
 * Delete a recording.
 */
export async function deleteRecording(recordingId: string): Promise<void> {
  await idbDel(`${IDB_RECORDINGS_PREFIX}${recordingId}`);
  const index: TelemetryRecording[] = (await idbGet(IDB_RECORDINGS_INDEX)) ?? [];
  const filtered = index.filter((r) => r.id !== recordingId);
  await idbSet(IDB_RECORDINGS_INDEX, filtered);
}

/**
 * Export a recording as CSV.
 */
export async function exportRecordingCSV(recordingId: string): Promise<string> {
  const frames = await loadRecordingFrames(recordingId);
  if (frames.length === 0) return "";

  const rows = ["offsetMs,channel,data"];
  for (const frame of frames) {
    rows.push(`${frame.offsetMs},${frame.channel},"${JSON.stringify(frame.data).replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}
