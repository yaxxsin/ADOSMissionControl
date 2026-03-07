/**
 * @module aircraft-icons
 * @description Pre-generated SVG aircraft icon data URIs at multiple sizes
 * and colors, cached for GPU-instanced BillboardCollection rendering.
 * @license GPL-3.0-only
 */

"use client";

/** Top-down aircraft silhouette SVG template. SIZE and COLOR are replaced. */
const AIRCRAFT_SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 32 32">
  <path d="M16 2 L20 14 L30 18 L20 20 L18 30 L16 24 L14 30 L12 20 L2 18 L12 14 Z" fill="COLOR" stroke="#000" stroke-width="0.5"/>
</svg>`;

export const ICON_SIZES = [16, 24, 32] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const AIRCRAFT_COLORS = {
  default: "#3A82FF",
  ra: "#FF4444",
  ta: "#FF8C00",
  proximate: "#6BA3FF",
  other: "#5A7AAA",
  selected: "#FFFFFF",
} as const;

type AircraftColorKey = keyof typeof AIRCRAFT_COLORS;

/** Cache: "color-size" -> data URI */
const iconCache = new Map<string, string>();

/** Get or create a cached SVG data URI for a given color and pixel size. */
export function getAircraftIcon(color: string, size: number): string {
  const key = `${color}-${size}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const svg = AIRCRAFT_SVG_TEMPLATE
    .replace(/SIZE/g, String(size))
    .replace("COLOR", color);
  const uri = `data:image/svg+xml;base64,${btoa(svg)}`;
  iconCache.set(key, uri);
  return uri;
}

/** Map threat level string to a hex color, with selection override. */
export function getAircraftColorForThreat(threat: string, isSelected: boolean): string {
  if (isSelected) return AIRCRAFT_COLORS.selected;
  return AIRCRAFT_COLORS[threat as AircraftColorKey] ?? AIRCRAFT_COLORS.other;
}
