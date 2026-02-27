/**
 * @module RecordingControls
 * @description Header-bar telemetry recording controls.
 * Start/stop recording, shows duration and frame count while active.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { CircleDot, Square, Download } from "lucide-react";
import {
  startRecording,
  stopRecording,
  getRecordingState,
  exportRecordingCSV,
} from "@/lib/telemetry-recorder";
import { useDroneManager } from "@/stores/drone-manager";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function RecordingControls({ className }: { className?: string }) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [lastRecordingId, setLastRecordingId] = useState<string | null>(null);

  // Poll recording state while active
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      const state = getRecordingState();
      setDurationMs(state.durationMs);
      setFrameCount(state.frameCount);
    }, 250);
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStart = useCallback(() => {
    const drone = useDroneManager.getState().getSelectedDrone();
    const id = startRecording(drone?.id, drone?.name);
    setIsRecording(true);
    setLastRecordingId(id);
    toast("Recording started", "success");
  }, [toast]);

  const handleStop = useCallback(async () => {
    const recording = await stopRecording();
    setIsRecording(false);
    setDurationMs(0);
    setFrameCount(0);
    if (recording) {
      setLastRecordingId(recording.id);
      toast(
        `Recording saved: ${recording.frameCount} frames, ${formatDuration(recording.durationMs)}`,
        "success",
      );
    }
  }, [toast]);

  const handleExport = useCallback(async () => {
    if (!lastRecordingId) return;
    const csv = await exportRecordingCSV(lastRecordingId);
    if (!csv) {
      toast("No frames to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telemetry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported", "success");
  }, [lastRecordingId, toast]);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {isRecording ? (
        <>
          {/* Recording indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-status-error/10 border border-status-error/30 text-status-error">
            <CircleDot size={10} className="animate-pulse" />
            <span className="text-[10px] font-mono tabular-nums">
              {formatDuration(durationMs)}
            </span>
            <span className="text-[9px] font-mono text-text-tertiary">
              {frameCount}f
            </span>
          </div>
          <button
            onClick={handleStop}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-status-error/30 text-status-error hover:bg-status-error/10 transition-colors"
            title="Stop recording"
          >
            <Square size={8} />
            STOP
          </button>
        </>
      ) : (
        <>
          <button
            onClick={handleStart}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-border-default text-text-secondary hover:text-text-primary hover:border-status-error/50 transition-colors"
            title="Start telemetry recording"
          >
            <CircleDot size={10} />
            REC
          </button>
          {lastRecordingId && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-mono border border-border-default text-text-tertiary hover:text-text-primary transition-colors"
              title="Export last recording as CSV"
            >
              <Download size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
