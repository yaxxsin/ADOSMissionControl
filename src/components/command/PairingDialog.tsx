"use client";

/**
 * @module PairingDialog
 * @description Modal dialog for pairing a new ADOS Drone Agent.
 * Supports manual 6-char code entry, discovered agent cards, and pre-generated codes.
 * @license GPL-3.0-only
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Loader2,
  Check,
  Copy,
  AlertCircle,
  Cpu,
  Wifi,
} from "lucide-react";
import { useMutation } from "convex/react";
import { cn } from "@/lib/utils";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { cmdPairingApi } from "@/lib/community-api-drones";
import { usePairingStore, type DiscoveredAgent } from "@/stores/pairing-store";

interface PairingDialogProps {
  open: boolean;
  onClose: () => void;
  onPaired?: (deviceId: string, apiKey: string, url: string) => void;
}

type PairingState = "input" | "claiming" | "success" | "error";

const INSTALL_COMMAND = "curl -sSL https://raw.githubusercontent.com/altnautica/ADOSDroneAgent/main/scripts/install.sh | sudo bash";

export function PairingDialog({ open, onClose, onPaired }: PairingDialogProps) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<PairingState>("input");
  const [errorMessage, setErrorMessage] = useState("");
  const [pairedInfo, setPairedInfo] = useState<{
    deviceId: string;
    name: string;
    apiKey: string;
    mdnsHost: string;
  } | null>(null);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [preGenCode, setPreGenCode] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const convexAvailable = useConvexAvailable();
  // convexAvailable is stable (env-var derived, never changes between renders)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const claimCode = convexAvailable ? useMutation(cmdPairingApi.claimPairingCode) : null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const preGenerate = convexAvailable ? useMutation(cmdPairingApi.preGenerateCode) : null;

  const discoveredAgents = usePairingStore((s) => s.discoveredAgents);
  const setPairingInProgress = usePairingStore((s) => s.setPairingInProgress);
  const setPairingError = usePairingStore((s) => s.setPairingError);

  useEffect(() => {
    if (open) {
      setCode("");
      setState("input");
      setErrorMessage("");
      setPairedInfo(null);
      setPreGenCode(null);
      // Focus the input after a brief delay for the modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleCodeChange = useCallback(
    (value: string) => {
      const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
      setCode(cleaned);
      setErrorMessage("");
      if (cleaned.length === 6) {
        submitCode(cleaned);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function submitCode(pairingCode: string) {
    setState("claiming");
    setPairingInProgress(true);
    setPairingError(null);

    try {
      if (!claimCode) {
        throw new Error("Convex not available. Cannot pair in local-only mode.");
      }

      const result = await claimCode({ code: pairingCode });
      const info = {
        deviceId: result.deviceId || `ados-${pairingCode.toLowerCase()}`,
        name: result.name || "ADOS Agent",
        apiKey: result.apiKey || "",
        mdnsHost: result.mdnsHost || `ados-${pairingCode.toLowerCase()}.local`,
      };
      setPairedInfo(info);
      setState("success");
      setPairingInProgress(false);

      // Auto-connect after a brief pause
      setTimeout(() => {
        const host = info.mdnsHost || result.localIp;
        if (host) {
          onPaired?.(info.deviceId, info.apiKey, `http://${host}:8080`);
        }
      }, 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Pairing failed";
      // Extract user-friendly message from Convex error
      const msg = raw.includes("expired")
        ? "Pairing code expired. Ask the agent to generate a new one."
        : raw.includes("already claimed")
          ? "This code was already used by another account."
          : raw.includes("Invalid")
            ? "Invalid pairing code. Check the code on your agent terminal."
            : raw;
      setErrorMessage(msg);
      setState("error");
      setPairingInProgress(false);
      setPairingError(msg);
    }
  }

  function handleDiscoveredPair(agent: DiscoveredAgent) {
    setCode(agent.pairingCode);
    submitCode(agent.pairingCode);
  }

  async function handlePreGenerate() {
    if (!preGenerate) {
      // Fallback for local-only mode
      const generated = Array.from({ length: 6 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
      ).join("");
      setPreGenCode(generated);
      return;
    }
    try {
      const result = await preGenerate({});
      setPreGenCode(result.code);
    } catch {
      // Fallback to local generation on error
      const generated = Array.from({ length: 6 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
      ).join("");
      setPreGenCode(generated);
    }
  }

  function handleCopyInstall() {
    navigator.clipboard.writeText(INSTALL_COMMAND).then(() => {
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 2000);
    });
  }

  function handleCopyCode() {
    if (!preGenCode) return;
    navigator.clipboard
      .writeText(`curl -sSL https://raw.githubusercontent.com/altnautica/ADOSDroneAgent/main/scripts/install.sh | sudo bash -s -- --pair ${preGenCode}`)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      });
  }

  function handleRetry() {
    setCode("");
    setState("input");
    setErrorMessage("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            Pair New Drone
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Code Input */}
          {state === "input" && (
            <>
              <div className="text-center space-y-2">
                <p className="text-xs text-text-secondary">
                  Enter the 6-character pairing code shown on your drone agent.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    maxLength={6}
                    placeholder="------"
                    className="w-64 text-center text-2xl font-mono font-bold tracking-[0.5em] bg-bg-primary border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary/40 outline-none focus:border-accent-primary transition-colors uppercase"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="absolute -bottom-5 left-0 right-0 text-center">
                    <span className="text-[10px] text-text-tertiary">
                      {code.length}/6 characters
                    </span>
                  </div>
                </div>
              </div>

              {/* Discovered Agents */}
              {discoveredAgents.length > 0 && (
                <div className="pt-3 space-y-2">
                  <p className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider">
                    Discovered on network
                  </p>
                  <div className="space-y-2">
                    {discoveredAgents.map((agent) => (
                      <button
                        key={agent.deviceId}
                        onClick={() => handleDiscoveredPair(agent)}
                        className="w-full flex items-center gap-3 p-3 bg-bg-primary border border-border-default rounded hover:border-accent-primary/50 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center shrink-0">
                          <Cpu size={14} className="text-accent-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-text-primary truncate">
                              {agent.name}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              {agent.board}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Wifi size={10} className="text-status-success" />
                            <span className="text-[10px] text-text-tertiary font-mono">
                              {agent.pairingCode}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          Pair
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-generate section */}
              <div className="pt-2 border-t border-border-default">
                {preGenCode ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-text-tertiary">
                      Run this on your drone to pair with a pre-generated code:
                    </p>
                    <div className="flex items-center gap-2 p-2 bg-bg-primary border border-border-default rounded">
                      <code className="flex-1 text-[11px] font-mono text-text-secondary truncate select-all">
                        curl -sSL https://raw.githubusercontent.com/altnautica/ADOSDroneAgent/main/scripts/install.sh | sudo bash -s -- --pair {preGenCode}
                      </code>
                      <button
                        onClick={handleCopyCode}
                        className="p-1 text-text-tertiary hover:text-text-primary transition-colors shrink-0"
                      >
                        {copiedCode ? (
                          <Check size={12} className="text-status-success" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handlePreGenerate}
                    className="w-full text-center text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors py-1"
                  >
                    Pre-generate a code instead
                  </button>
                )}
              </div>
            </>
          )}

          {/* Claiming state */}
          {state === "claiming" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-accent-primary" />
              <p className="text-xs text-text-secondary">
                Pairing with code{" "}
                <span className="font-mono font-bold text-text-primary">{code}</span>...
              </p>
            </div>
          )}

          {/* Success state */}
          {state === "success" && pairedInfo && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-status-success/15 flex items-center justify-center">
                <Check size={20} className="text-status-success" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-text-primary">Paired!</p>
                <p className="text-xs text-text-secondary">
                  {pairedInfo.name}
                </p>
                <p className="text-[10px] text-text-tertiary font-mono">
                  {pairedInfo.mdnsHost}
                </p>
              </div>
              <p className="text-[11px] text-text-tertiary">
                Connecting automatically...
              </p>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-status-error/15 flex items-center justify-center">
                <AlertCircle size={20} className="text-status-error" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-text-primary">
                  Pairing Failed
                </p>
                <p className="text-xs text-status-error">{errorMessage}</p>
              </div>
              <button
                onClick={handleRetry}
                className="px-4 py-1.5 text-xs font-medium bg-bg-tertiary border border-border-default rounded hover:bg-bg-primary transition-colors text-text-primary"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Install help */}
          {state === "input" && (
            <div className="border-t border-border-default pt-4 space-y-2">
              <p className="text-[11px] text-text-tertiary">
                Don&apos;t have the agent installed yet?
              </p>
              <div className="flex items-center gap-2 p-2 bg-bg-primary border border-border-default rounded">
                <code className="flex-1 text-[11px] font-mono text-text-secondary truncate select-all">
                  {INSTALL_COMMAND}
                </code>
                <button
                  onClick={handleCopyInstall}
                  className="p-1 text-text-tertiary hover:text-text-primary transition-colors shrink-0"
                >
                  {copiedInstall ? (
                    <Check size={12} className="text-status-success" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline pairing code input for embedding in other pages (e.g., AgentDisconnectedPage).
 * Same 6-char input logic without the modal wrapper.
 */
export function PairingCodeInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(value: string) {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    setCode(cleaned);
    if (cleaned.length === 6) {
      onSubmit(cleaned);
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={code}
      onChange={(e) => handleChange(e.target.value)}
      maxLength={6}
      disabled={disabled}
      placeholder="------"
      className={cn(
        "w-52 text-center text-xl font-mono font-bold tracking-[0.4em] bg-bg-primary border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary/40 outline-none focus:border-accent-primary transition-colors uppercase",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
