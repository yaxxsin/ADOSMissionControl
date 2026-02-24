"use client";

import { useState, useEffect, useRef } from "react";
import { Home, ArrowDownToLine, ArrowUpFromLine, Pause, Play, Power, XOctagon, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlightModeSelector } from "@/components/shared/flight-mode-selector";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";

export function FlightControlsBar() {
  const armState = useDroneStore((s) => s.armState);
  const flightMode = useDroneStore((s) => s.flightMode);
  const previousMode = useDroneStore((s) => s.previousMode);
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const setArmState = useDroneStore((s) => s.setArmState);
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);

  const [showRthConfirm, setShowRthConfirm] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [showKillFinal, setShowKillFinal] = useState(false);
  const [killCountdown, setKillCountdown] = useState(3);
  const [showTakeoffPopover, setShowTakeoffPopover] = useState(false);
  const [takeoffAlt, setTakeoffAlt] = useState("10");
  const popoverRef = useRef<HTMLDivElement>(null);

  const isArmed = armState === "armed";
  const protocol = getProtocol();

  // Close takeoff popover on outside click
  useEffect(() => {
    if (!showTakeoffPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowTakeoffPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTakeoffPopover]);

  // Kill switch countdown
  useEffect(() => {
    if (!showKillFinal) {
      setKillCountdown(3);
      return;
    }
    if (killCountdown <= 0) return;
    const timer = setTimeout(() => setKillCountdown(killCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [showKillFinal, killCountdown]);

  return (
    <>
      <div className="h-14 bg-bg-secondary border-t border-border-default flex items-center justify-between px-4 shrink-0">
        {/* Left: Flight actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Home size={14} />}
            onClick={() => setShowRthConfirm(true)}
            className="text-status-warning border-status-warning/30"
          >
            RTH
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => {
              if (protocol) protocol.land();
              else setFlightMode("LAND");
            }}
          >
            LAND
          </Button>
          {/* Context-aware HOLD/PAUSE/RESUME */}
          {flightMode === "AUTO" ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause size={14} />}
              onClick={() => {
                if (protocol) protocol.pauseMission();
                else setFlightMode("LOITER");
              }}
            >
              PAUSE
            </Button>
          ) : flightMode === "LOITER" && previousMode === "AUTO" ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Play size={14} />}
              onClick={() => {
                if (protocol) protocol.resumeMission();
                else setFlightMode("AUTO");
              }}
            >
              RESUME
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause size={14} />}
              onClick={() => {
                if (protocol) protocol.setFlightMode("LOITER");
                else setFlightMode("LOITER");
              }}
            >
              HOLD
            </Button>
          )}
        </div>

        {/* Center: ARM/DISARM + Takeoff + Mode */}
        <div className="flex items-center gap-3">
          <Button
            variant={isArmed ? "danger" : "primary"}
            size="sm"
            icon={<Power size={14} />}
            onClick={() => {
              if (protocol) {
                if (isArmed) protocol.disarm();
                else protocol.arm();
              } else {
                setArmState(isArmed ? "disarmed" : "armed");
              }
            }}
          >
            {isArmed ? "DISARM" : "ARM"}
          </Button>

          {/* Takeoff */}
          <div className="relative" ref={popoverRef}>
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowUpFromLine size={14} />}
              onClick={() => setShowTakeoffPopover(!showTakeoffPopover)}
              disabled={isArmed && flightMode !== "STABILIZE" && flightMode !== "GUIDED" && flightMode !== "ALT_HOLD"}
            >
              TAKEOFF
            </Button>
            {showTakeoffPopover && (
              <div className="absolute bottom-full left-0 mb-2 bg-bg-secondary border border-border-default p-3 shadow-lg z-50 w-48">
                <label className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">
                  Takeoff Altitude
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={takeoffAlt}
                    onChange={(e) => setTakeoffAlt(e.target.value)}
                    className="flex-1 h-7 px-2 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                    min="1"
                    max="120"
                    step="1"
                  />
                  <span className="text-xs text-text-tertiary">m</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    const alt = parseFloat(takeoffAlt);
                    if (isNaN(alt) || alt <= 0) return;
                    if (protocol) {
                      if (!isArmed) protocol.arm();
                      protocol.takeoff(alt);
                    }
                    setShowTakeoffPopover(false);
                  }}
                >
                  Arm & Takeoff
                </Button>
              </div>
            )}
          </div>

          <FlightModeSelector
            value={flightMode}
            onChange={(mode) => {
              if (protocol) protocol.setFlightMode(mode);
              else setFlightMode(mode);
            }}
            className="w-28"
          />
        </div>

        {/* Right: Abort + Kill */}
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            icon={<XOctagon size={14} />}
            onClick={() => setShowAbortConfirm(true)}
          >
            ABORT
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Skull size={14} />}
            onClick={() => setShowKillConfirm(true)}
            className="bg-red-800 hover:bg-red-700 border-red-600"
          >
            KILL
          </Button>
        </div>
      </div>

      {/* RTH Confirmation */}
      <ConfirmDialog
        open={showRthConfirm}
        onCancel={() => setShowRthConfirm(false)}
        onConfirm={() => {
          if (protocol) protocol.returnToLaunch();
          else setFlightMode("RTL");
          setShowRthConfirm(false);
        }}
        title="Return to Home"
        message="The drone will abort its current mission and return to the home position. Are you sure?"
        confirmLabel="Return to Home"
        variant="primary"
      />

      {/* Abort Confirmation */}
      <ConfirmDialog
        open={showAbortConfirm}
        onCancel={() => setShowAbortConfirm(false)}
        onConfirm={() => {
          if (protocol) {
            protocol.land();
            protocol.disarm();
          } else {
            setFlightMode("LAND");
            setArmState("disarmed");
          }
          setShowAbortConfirm(false);
        }}
        title="Emergency Abort"
        message="This will immediately stop the mission and initiate emergency landing. This action cannot be undone. Are you sure?"
        confirmLabel="ABORT MISSION"
        variant="danger"
      />

      {/* Kill Switch — Step 1 */}
      <ConfirmDialog
        open={showKillConfirm}
        onCancel={() => setShowKillConfirm(false)}
        onConfirm={() => {
          setShowKillConfirm(false);
          setShowKillFinal(true);
        }}
        title="Kill Switch"
        message="This will IMMEDIATELY CUT ALL MOTORS. The drone will fall from the sky. This is an emergency-only action. Are you absolutely sure?"
        confirmLabel="I understand — proceed"
        variant="danger"
      />

      {/* Kill Switch — Step 2: Countdown */}
      <ConfirmDialog
        open={showKillFinal}
        onCancel={() => {
          setShowKillFinal(false);
          setKillCountdown(3);
        }}
        onConfirm={() => {
          if (protocol) protocol.killSwitch();
          setShowKillFinal(false);
          setKillCountdown(3);
        }}
        title="FINAL CONFIRMATION — KILL MOTORS"
        message={`Motors will be cut immediately. Drone will fall. ${killCountdown > 0 ? `Wait ${killCountdown}s...` : "Button enabled."}`}
        confirmLabel={killCountdown > 0 ? `Wait ${killCountdown}s...` : "KILL MOTORS NOW"}
        variant="danger"
        confirmDisabled={killCountdown > 0}
      />
    </>
  );
}
