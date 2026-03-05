"use client";

import { useState, useEffect } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { PreFlightChecklist } from "@/components/flight/PreFlightChecklist";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";

interface ActionDialogsProps {
  showRthConfirm: boolean;
  setShowRthConfirm: (v: boolean) => void;
  showAbortConfirm: boolean;
  setShowAbortConfirm: (v: boolean) => void;
  showKillConfirm: boolean;
  setShowKillConfirm: (v: boolean) => void;
  showChecklist: boolean;
  setShowChecklist: (v: boolean) => void;
}

export function ActionDialogs({
  showRthConfirm, setShowRthConfirm,
  showAbortConfirm, setShowAbortConfirm,
  showKillConfirm, setShowKillConfirm,
  showChecklist, setShowChecklist,
}: ActionDialogsProps) {
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const setArmState = useDroneStore((s) => s.setArmState);
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getProtocol();

  const [showKillFinal, setShowKillFinal] = useState(false);
  const [killCountdown, setKillCountdown] = useState(3);

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

      <ConfirmDialog
        open={showKillConfirm}
        onCancel={() => setShowKillConfirm(false)}
        onConfirm={() => {
          setShowKillConfirm(false);
          setShowKillFinal(true);
        }}
        title="Kill Switch"
        message="This will IMMEDIATELY CUT ALL MOTORS. The drone will fall from the sky. This is an emergency-only action. Are you absolutely sure?"
        confirmLabel="I understand - proceed"
        variant="danger"
      />

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
        title="FINAL CONFIRMATION - KILL MOTORS"
        message={`Motors will be cut immediately. Drone will fall. ${killCountdown > 0 ? `Wait ${killCountdown}s...` : "Button enabled."}`}
        confirmLabel={killCountdown > 0 ? `Wait ${killCountdown}s...` : "KILL MOTORS NOW"}
        variant="danger"
        confirmDisabled={killCountdown > 0}
      />

      <Modal
        open={showChecklist}
        onClose={() => setShowChecklist(false)}
        title="Pre-Flight Checklist"
        className="max-w-md max-h-[80vh] flex flex-col"
      >
        <PreFlightChecklist className="max-h-[60vh] -mx-4 -my-4" />
      </Modal>
    </>
  );
}
