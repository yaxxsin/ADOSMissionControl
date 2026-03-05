"use client";

import { ParamTooltip } from "./ParamTooltip";
import type { ParamMetadata } from "@/lib/protocol/param-metadata";

/**
 * Wraps a parameter label string with ParamTooltip for hover metadata.
 * Extracts the param name from labels like "PARAM_NAME -- Description".
 * If no metadata is found, renders the label as-is.
 */
export function ParamLabel({
  label,
  paramName,
  metadata,
}: {
  label: string;
  paramName?: string;
  metadata?: Map<string, ParamMetadata>;
}) {
  const name = paramName || extractParamName(label);
  const meta = metadata?.get(name);

  if (!meta) return <>{label}</>;

  return (
    <ParamTooltip meta={meta}>
      <span className="cursor-default border-b border-dotted border-text-tertiary/40">{label}</span>
    </ParamTooltip>
  );
}

/** Extract param name from "PARAM_NAME — Description" format. */
function extractParamName(label: string): string {
  const sep = label.indexOf(" \u2014 ");
  if (sep !== -1) return label.slice(0, sep).trim();
  return label.trim();
}
