/**
 * @module hud-draw-status
 * @description Status drawing (battery bar, GPS/mode, armed status, signal bars, flight timer).
 * @license GPL-3.0-only
 */

import {
  HUD_GREEN, ARMED_RED, DISARMED_GREEN, SHADOW, FONT,
  batColor, formatTimerFromMs, setHudStyle, clearShadow,
} from "./hud-draw";

export function drawBatteryHud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  pct: number
) {
  const barW = 200;
  const barH = 10;
  const left = cx - barW / 2;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(left, y, barW, barH);

  const fillW = (pct / 100) * barW;
  ctx.fillStyle = batColor(pct);
  ctx.fillRect(left, y, fillW, barH);

  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, y, barW, barH);

  setHudStyle(ctx, "#ffffff", 10, "center", "top");
  ctx.fillText(`${Math.round(pct)}%`, cx, y + barH + 3);
  clearShadow(ctx);
}

export function drawGpsAndMode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  satellites: number,
  mode: string
) {
  setHudStyle(ctx, HUD_GREEN, 11, "left", "bottom");
  ctx.fillText(`\u2736 ${satellites} SAT`, x, y);
  ctx.fillText(mode, x, y + 16);
  clearShadow(ctx);
}

export function drawArmedStatus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  armed: boolean
) {
  const text = armed ? "ARMED" : "DISARMED";
  const color = armed ? ARMED_RED : DISARMED_GREEN;

  setHudStyle(ctx, color, 12, "center", "top");
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(text, cx, y);
  clearShadow(ctx);
}

export function drawSignalBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bars: number
) {
  const barW = 3;
  const gap = 2;
  const maxH = 12;

  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  for (let i = 0; i < 4; i++) {
    const bh = ((i + 1) / 4) * maxH;
    const bx = x + i * (barW + gap);
    const by = y - bh;
    ctx.fillStyle = i < bars ? HUD_GREEN : "rgba(255,255,255,0.2)";
    ctx.fillRect(bx, by, barW, bh);
  }
  clearShadow(ctx);
}

export function drawFlightTimer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  startedAt: number | undefined
) {
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  setHudStyle(ctx, HUD_GREEN, 11, "right", "bottom");
  ctx.fillText(formatTimerFromMs(elapsed), x, y);
  clearShadow(ctx);
}
