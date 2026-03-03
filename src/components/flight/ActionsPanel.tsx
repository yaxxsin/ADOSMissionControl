"use client";

import { useState, useEffect } from "react";
import {
  Power,
  ArrowUpFromLine,
  Home,
  ArrowDownToLine,
  Pause,
  Play,
  XOctagon,
  Skull,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlightModeSelector } from "@/components/shared/flight-mode-selector";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";

export function ActionsPanel() {
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
  const [takeoffAlt, setTakeoffAlt] = useState("10");

  const isArmed = armState === "armed";
  const protocol = getProtocol();

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
      <div className="px-3 py-3 border-t border-border-default flex flex-col gap-1.5">
        {/* ARM / DISARM */}
        <Tooltip
          content={isArmed ? "Disarm motors \u2014 cut throttle output" : "Arm motors \u2014 enable throttle output"}
          position="right"
        >
          <Button
            variant={isArmed ? "danger" : "primary"}
            size="sm"
            icon={<Power size={14} />}
            className="w-full h-9 text-sm"
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
        </Tooltip>

        {/* TAKEOFF + altitude input */}
        <div className="flex items-center gap-2">
          <Tooltip content="Arm and takeoff to target altitude" position="right">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowUpFromLine size={14} />}
              className="flex-1"
              onClick={() => {
                const alt = parseFloat(takeoffAlt);
                if (isNaN(alt) || alt <= 0) return;
                if (protocol) {
                  if (!isArmed) protocol.arm();
                  protocol.takeoff(alt);
                }
              }}
            >
              TAKEOFF
            </Button>
          </Tooltip>
          <Tooltip content="Takeoff altitude in meters (1\u2013120m)" position="right">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={takeoffAlt}
                onChange={(e) => setTakeoffAlt(e.target.value)}
                className="w-16 h-7 px-2 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary text-center focus:outline-none focus:border-accent-primary"
                min="1"
                max="120"
                step="1"
              />
              <span className="text-[10px] text-text-tertiary font-mono">m</span>
            </div>
          </Tooltip>
        </div>

        {/* Flight mode selector */}
        <div>
          <FlightModeSelector
            value={flightMode}
            onChange={(mode) => {
              if (protocol) protocol.setFlightMode(mode);
              else setFlightMode(mode);
            }}
            className="w-full"
          />
        </div>

        {/* NAVIGATION — RTH / LAND / HOLD */}
        <div className="flex items-center gap-1.5">
          <Tooltip content="Return to home position" position="right">
            <Button
              variant="secondary"
              size="sm"
              icon={<Home size={14} />}
              className="flex-1 text-status-warning border-status-warning/30"
              onClick={() => setShowRthConfirm(true)}
            >
              RTH
            </Button>
          </Tooltip>
          <Tooltip content="Land at current position" position="right">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowDownToLine size={14} />}
              className="flex-1"
              onClick={() => {
                if (protocol) protocol.land();
                else setFlightMode("LAND");
              }}
            >
              LAND
            </Button>
          </Tooltip>
          {/* Context-aware HOLD/PAUSE/RESUME */}
          {flightMode === "AUTO" ? (
            <Tooltip content="Pause mission and hold position" position="right">
              <Button
                variant="secondary"
                size="sm"
                icon={<Pause size={14} />}
                className="flex-1"
                onClick={() => {
                  if (protocol) protocol.pauseMission();
                  else setFlightMode("LOITER");
                }}
              >
                PAUSE
              </Button>
            </Tooltip>
          ) : flightMode === "LOITER" && previousMode === "AUTO" ? (
            <Tooltip content="Resume paused mission" position="right">
              <Button
                variant="secondary"
                size="sm"
                icon={<Play size={14} />}
                className="flex-1"
                onClick={() => {
                  if (protocol) protocol.resumeMission();
                  else setFlightMode("AUTO");
                }}
              >
                RESUME
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Hold position and altitude" position="right">
              <Button
                variant="secondary"
                size="sm"
                icon={<Pause size={14} />}
                className="flex-1"
                onClick={() => {
                  if (protocol) protocol.setFlightMode("LOITER");
                  else setFlightMode("LOITER");
                }}
              >
                HOLD
              </Button>
            </Tooltip>
          )}
        </div>

        {/* EMERGENCY — danger zone tint */}
        <div className="bg-status-error/5 p-1.5 rounded">
          <div className="flex items-center gap-1.5">
            <Tooltip content="Emergency land and disarm" position="right">
              <Button
                variant="danger"
                size="sm"
                icon={<XOctagon size={14} />}
                className="flex-1"
                onClick={() => setShowAbortConfirm(true)}
              >
                ABORT
              </Button>
            </Tooltip>
            <Tooltip content="Cut all motors immediately" position="right">
              <Button
                variant="danger"
                size="sm"
                icon={<Skull size={14} />}
                className="flex-1 bg-red-800 hover:bg-red-700 border-red-600"
                onClick={() => setShowKillConfirm(true)}
              >
                KILL
              </Button>
            </Tooltip>
          </div>
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
