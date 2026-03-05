/**
 * Firmware panel constants — vehicle types, firmware stacks, flash methods.
 */

import type { FlashMethod, FirmwareStack } from "@/lib/protocol/firmware/types";
import { Wifi, Usb, Radio } from "lucide-react";

export const VEHICLE_TYPES = [
  { value: "Copter", label: "ArduCopter (Multirotor)" },
  { value: "Plane", label: "ArduPlane (Fixed Wing)" },
  { value: "Rover", label: "ArduRover (Ground Vehicle)" },
  { value: "Sub", label: "ArduSub (Submarine)" },
];

export const FIRMWARE_STACKS: { id: FirmwareStack; label: string }[] = [
  { id: "ardupilot", label: "ArduPilot" },
  { id: "betaflight", label: "Betaflight" },
  { id: "px4", label: "PX4" },
];

export const AP_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try serial first, then DFU" },
  { id: "serial", label: "Serial", icon: Wifi, desc: "STM32 UART bootloader (most FCs)" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU (some H7 boards)" },
];

export const BF_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try serial first, then DFU" },
  { id: "serial", label: "Serial", icon: Wifi, desc: "STM32 UART bootloader" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU" },
];

export const PX4_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try PX4 serial first, then DFU" },
  { id: "px4-serial", label: "PX4 Serial", icon: Wifi, desc: "PX4 bootloader (px_uploader)" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU" },
];

export function versionLabel(v: string): string {
  const lower = v.toLowerCase();
  if (lower.startsWith("stable") || lower === "official") return `Stable ${v.replace(/^stable-/i, "")} (Recommended)`;
  if (lower === "beta") return "Latest Beta";
  if (lower === "latest") return "Latest Build";
  if (lower === "dev") return "Development (Unstable)";
  return v;
}
