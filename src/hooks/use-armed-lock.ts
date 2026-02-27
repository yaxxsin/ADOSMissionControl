import { useDroneStore } from "@/stores/drone-store";

interface ArmedLockResult {
  /** Whether the vehicle is currently armed */
  isArmed: boolean;
  /** Whether config changes should be blocked (armed + connected) */
  isLocked: boolean;
  /** Message to display when locked */
  lockMessage: string;
}

export function useArmedLock(): ArmedLockResult {
  const armState = useDroneStore((s) => s.armState);
  const connectionState = useDroneStore((s) => s.connectionState);

  const isArmed = armState === "armed";
  const isConnected = connectionState !== "disconnected";
  const isLocked = isArmed && isConnected;

  return {
    isArmed,
    isLocked,
    lockMessage: isLocked
      ? "Configuration changes are disabled while the vehicle is armed. Disarm to modify settings."
      : "",
  };
}
