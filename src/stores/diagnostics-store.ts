import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";

interface MessageLogEntry {
  timestamp: number;
  msgId: number;
  msgName: string;
  direction: "in" | "out";
  size: number;
}

type EventType =
  | "connect"
  | "disconnect"
  | "arm"
  | "disarm"
  | "mode_change"
  | "error"
  | "calibration"
  | "param_write"
  | "flash_commit"
  | "mission_upload"
  | "mission_download";

interface EventTimelineEntry {
  timestamp: number;
  type: EventType;
  description: string;
}

interface ConnectionLogEntry {
  type: "connect" | "disconnect" | "error";
  timestamp: number;
  details: string;
}

interface CalibrationHistoryEntry {
  type: string;
  result: "success" | "failed" | "cancelled";
  timestamp: number;
}

interface DiagnosticsStoreState {
  messageLog: RingBuffer<MessageLogEntry>;
  eventTimeline: RingBuffer<EventTimelineEntry>;
  connectionLog: ConnectionLogEntry[];
  calibrationHistory: CalibrationHistoryEntry[];

  logMessage: (msgId: number, msgName: string, direction: "in" | "out", size: number) => void;
  logEvent: (type: EventType, description: string) => void;
  logConnection: (type: "connect" | "disconnect" | "error", details: string) => void;
  logCalibration: (type: string, result: "success" | "failed" | "cancelled") => void;
  clear: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set, get) => ({
  messageLog: new RingBuffer<MessageLogEntry>(2000),
  eventTimeline: new RingBuffer<EventTimelineEntry>(500),
  connectionLog: [],
  calibrationHistory: [],

  logMessage: (msgId, msgName, direction, size) => {
    get().messageLog.push({
      timestamp: Date.now(),
      msgId,
      msgName,
      direction,
      size,
    });
    set({});
  },

  logEvent: (type, description) => {
    get().eventTimeline.push({
      timestamp: Date.now(),
      type,
      description,
    });
    set({});
  },

  logConnection: (type, details) => {
    const log = get().connectionLog;
    log.push({ type, timestamp: Date.now(), details });
    set({ connectionLog: [...log] });
  },

  logCalibration: (type, result) => {
    const history = get().calibrationHistory;
    history.push({ type, result, timestamp: Date.now() });
    set({ calibrationHistory: [...history] });
  },

  clear: () =>
    set({
      messageLog: new RingBuffer<MessageLogEntry>(2000),
      eventTimeline: new RingBuffer<EventTimelineEntry>(500),
      connectionLog: [],
      calibrationHistory: [],
    }),
}));
