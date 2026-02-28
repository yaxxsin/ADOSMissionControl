/**
 * Mission and log-related protocol types.
 *
 * @module protocol/types/mission
 */

/** On-board log entry received from LOG_ENTRY (msg 118). */
export interface LogEntry {
  id: number;
  numLogs: number;
  lastLogId: number;
  size: number;
  /** Seconds since 1970 UTC, or 0 if unavailable. */
  timeUtc: number;
}

/** Progress callback for log data download. */
export type LogDownloadProgressCallback = (receivedBytes: number, totalBytes: number) => void;

/** Wire-format mission item for upload/download (INT variant). */
export interface MissionItem {
  seq: number;
  /** MAV_FRAME enum. */
  frame: number;
  /** MAV_CMD enum. */
  command: number;
  current: number;
  autocontinue: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  /** Latitude * 1e7. */
  x: number;
  /** Longitude * 1e7. */
  y: number;
  /** Altitude in meters. */
  z: number;
}
