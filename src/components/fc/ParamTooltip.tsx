"use client";

import { useState, useRef } from "react";
import type { ParamMetadata } from "@/lib/protocol/param-metadata";

/**
 * Inline tooltip for parameter name hover.
 * Shows humanName, description, rebootRequired flag, and valid range.
 */
export function ParamTooltip({ meta, children }: { meta: ParamMetadata | undefined; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!meta || (!meta.humanName && !meta.description)) {
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-0 top-full mt-1 z-50 max-w-[300px] whitespace-normal bg-bg-tertiary border border-border-default px-2.5 py-2 text-[10px] leading-relaxed">
          {meta.humanName && (
            <div className="font-semibold text-text-primary mb-0.5">{meta.humanName}</div>
          )}
          {meta.description && (
            <div className="text-text-secondary">{meta.description}</div>
          )}
          {meta.range && (
            <div className="text-text-tertiary mt-1">
              Range: {meta.range.min} &ndash; {meta.range.max}{meta.units ? ` ${meta.units}` : ""}
            </div>
          )}
          {meta.units && !meta.range && (
            <div className="text-text-tertiary mt-1">Units: {meta.units}</div>
          )}
          {meta.defaultValue !== undefined && (
            <div className="text-text-tertiary mt-1">Default: {meta.defaultValue}</div>
          )}
          {meta.increment && (
            <div className="text-text-tertiary mt-0.5">Step: {meta.increment}</div>
          )}
          {meta.rebootRequired && (
            <div className="text-status-warning mt-1">Reboot required after change</div>
          )}
        </div>
      )}
    </div>
  );
}
