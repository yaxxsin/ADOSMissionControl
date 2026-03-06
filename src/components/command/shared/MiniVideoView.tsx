"use client";

/**
 * @module MiniVideoView
 * @description Compact video thumbnail for the Drone Context Rail. Shows placeholder in demo mode.
 * @license GPL-3.0-only
 */

import { VideoOff } from "lucide-react";

export function MiniVideoView() {
  return (
    <div className="rounded border border-border-default bg-bg-tertiary overflow-hidden">
      <div className="flex items-center justify-center h-[112px] text-text-tertiary">
        <div className="flex flex-col items-center gap-1">
          <VideoOff size={18} />
          <span className="text-[10px]">NO SIGNAL</span>
        </div>
      </div>
    </div>
  );
}
