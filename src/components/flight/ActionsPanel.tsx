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
import { useFlightShortcuts } from "@/hooks/use-flight-shortcuts";


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

  useFlightShortcuts({
    enabled: true,
    onRthConfirm: () => setShowRthConfirm(true),
    onAbortConfirm: () => setShowAbortConfirm(true),
    takeoffAlt,
  });

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
      <div className="px-3 pt-3 pb-1.5 border-t border-border-default bg-bg-secondary flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {/* ARM / DISARM */}
          <div className="flex-1 [&>*]:w-full">
            <Tooltip
              content={isArmed ? "Disarm (Shift+A)" : "Arm (Shift+A)"}
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
          </div>

          {/* Flight mode selector */}
          <div className="flex-1">
            <FlightModeSelector
              value={flightMode}
              onChange={(mode) => {
                if (protocol) protocol.setFlightMode(mode);
                else setFlightMode(mode);
              }}
              className="w-full h-9"
            />
          </div>
        </div>

        {/* All action buttons */}
        <div className="flex items-center gap-1">
          <div className="flex-1 [&>*]:w-full">
            {flightMode === "AUTO" ? (
              <Tooltip content="Pause mission (Shift+P)" position="right">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={<Pause size={14} />}
                  onClick={() => {
                    if (protocol) protocol.pauseMission();
                    else setFlightMode("LOITER");
                  }}
                />
              </Tooltip>
            ) : flightMode === "LOITER" && previousMode === "AUTO" ? (
              <Tooltip content="Resume mission (Shift+P)" position="right">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={<Play size={14} />}
                  onClick={() => {
                    if (protocol) protocol.resumeMission();
                    else setFlightMode("AUTO");
                  }}
                />
              </Tooltip>
            ) : (
              <Tooltip content="Hold position (Shift+P)" position="right">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={<Pause size={14} />}
                  onClick={() => {
                    if (protocol) protocol.setFlightMode("LOITER");
                    else setFlightMode("LOITER");
                  }}
                />
              </Tooltip>
            )}
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Return to home (Shift+R)" position="right">
              <Button
                variant="secondary"
                size="sm"
                icon={<Home size={14} />}
                className="w-full text-status-warning border-status-warning/30"
                onClick={() => setShowRthConfirm(true)}
              />
            </Tooltip>
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Takeoff altitude (1\u2013120m)" position="right">
              <input
                type="number"
                value={takeoffAlt}
                onChange={(e) => setTakeoffAlt(e.target.value)}
                className="w-full h-7 px-1 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary text-center focus:outline-none focus:border-accent-primary"
                min="1"
                max="120"
                step="1"
              />
            </Tooltip>
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Takeoff (Shift+T)" position="right">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                icon={<ArrowUpFromLine size={14} />}
                onClick={() => {
                  const alt = parseFloat(takeoffAlt);
                  if (isNaN(alt) || alt <= 0) return;
                  if (protocol) {
                    if (!isArmed) protocol.arm();
                    protocol.takeoff(alt);
                  }
                }}
              />
            </Tooltip>
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Land (Shift+L)" position="left">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                icon={<ArrowDownToLine size={14} />}
                onClick={() => {
                  if (protocol) protocol.land();
                  else setFlightMode("LAND");
                }}
              />
            </Tooltip>
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Abort (Shift+X)" position="left">
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                icon={<XOctagon size={14} />}
                onClick={() => setShowAbortConfirm(true)}
              />
            </Tooltip>
          </div>
          <div className="flex-1 [&>*]:w-full">
            <Tooltip content="Kill motors" position="left">
              <Button
                variant="danger"
                size="sm"
                icon={<Skull size={14} />}
                className="w-full bg-red-800 hover:bg-red-700 border-red-600"
                onClick={() => setShowKillConfirm(true)}
              />
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
