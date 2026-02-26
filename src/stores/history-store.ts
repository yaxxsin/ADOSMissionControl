/**
 * History store — central source of truth for all flight records.
 *
 * Holds mock seed data + live-recorded flights + real log entries.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type { FlightRecord } from "@/lib/types";

/** On-board log entry received via LOG_ENTRY (msg 118). */
export interface LogEntry {
  id: number;
  numLogs: number;
  lastLogId: number;
  size: number;
  /** Seconds since 1970 UTC, or 0 if unavailable. */
  timeUtc: number;
}

/** Active log download progress. */
export interface LogDownloadState {
  logId: number;
  totalSize: number;
  receivedBytes: number;
  data: Uint8Array;
}

interface HistoryState {
  records: FlightRecord[];
  logEntries: Map<string, LogEntry[]>;
  logDownload: LogDownloadState | null;
  isLoadingLogList: boolean;
  isDownloadingLog: boolean;
  _seeded: boolean;
}

interface HistoryActions {
  /** One-time init from mock/history.ts seed data. */
  initWithSeedData: (records: FlightRecord[]) => void;
  /** Prepend a new flight record (cap at 500). */
  addRecord: (record: FlightRecord) => void;
  /** Store log entries for a drone from LOG_ENTRY messages. */
  setLogEntries: (droneId: string, entries: LogEntry[]) => void;
  setIsLoadingLogList: (v: boolean) => void;
  startLogDownload: (logId: number, totalSize: number) => void;
  updateLogDownload: (receivedBytes: number, data: Uint8Array) => void;
  completeLogDownload: () => void;
  cancelLogDownload: () => void;
}

const MAX_RECORDS = 500;

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
  records: [],
  logEntries: new Map(),
  logDownload: null,
  isLoadingLogList: false,
  isDownloadingLog: false,
  _seeded: false,

  initWithSeedData: (records) => {
    if (get()._seeded) return;
    set({ records, _seeded: true });
  },

  addRecord: (record) => {
    set((s) => ({
      records: [record, ...s.records].slice(0, MAX_RECORDS),
    }));
  },

  setLogEntries: (droneId, entries) => {
    set((s) => {
      const map = new Map(s.logEntries);
      map.set(droneId, entries);
      return { logEntries: map };
    });
  },

  setIsLoadingLogList: (v) => set({ isLoadingLogList: v }),

  startLogDownload: (logId, totalSize) => {
    set({
      logDownload: {
        logId,
        totalSize,
        receivedBytes: 0,
        data: new Uint8Array(totalSize),
      },
      isDownloadingLog: true,
    });
  },

  updateLogDownload: (receivedBytes, data) => {
    set((s) => {
      if (!s.logDownload) return s;
      return {
        logDownload: { ...s.logDownload, receivedBytes, data },
      };
    });
  },

  completeLogDownload: () => {
    set({ logDownload: null, isDownloadingLog: false });
  },

  cancelLogDownload: () => {
    set({ logDownload: null, isDownloadingLog: false });
  },
}));
