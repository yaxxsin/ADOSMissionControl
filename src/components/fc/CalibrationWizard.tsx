"use client";

import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalibrationStatus = "idle" | "in_progress" | "success" | "error";

export interface CalibrationStep {
  label: string;
  description: string;
}

interface CalibrationWizardProps {
  title: string;
  description: string;
  steps: CalibrationStep[];
  currentStep: number;
  status: CalibrationStatus;
  progress?: number;
  statusMessage?: string;
  onStart: () => void;
  onCancel?: () => void;
  className?: string;
}

const statusBadge: Record<CalibrationStatus, { label: string; className: string }> = {
  idle: { label: "Ready", className: "bg-bg-tertiary text-text-tertiary" },
  in_progress: { label: "Calibrating", className: "bg-accent-primary/20 text-accent-primary" },
  success: { label: "Complete", className: "bg-status-success/20 text-status-success" },
  error: { label: "Failed", className: "bg-status-error/20 text-status-error" },
};

export function CalibrationWizard({
  title,
  description,
  steps,
  currentStep,
  status,
  progress,
  statusMessage,
  onStart,
  onCancel,
  className,
}: CalibrationWizardProps) {
  const badge = statusBadge[status];

  return (
    <div className={cn("border border-border-default bg-bg-secondary p-4", className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
        </div>
        <span className={cn("text-[10px] font-mono px-2 py-0.5 shrink-0", badge.className)}>
          {badge.label}
        </span>
      </div>

      {steps.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {steps.map((step, i) => {
            const isComplete = status === "success" || (status === "in_progress" && i < currentStep);
            const isCurrent = status === "in_progress" && i === currentStep;
            const isFailed = status === "error" && i === currentStep;

            return (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {isComplete ? (
                    <CheckCircle size={14} className="text-status-success" />
                  ) : isFailed ? (
                    <XCircle size={14} className="text-status-error" />
                  ) : isCurrent ? (
                    <Loader2 size={14} className="text-accent-primary animate-spin" />
                  ) : (
                    <Circle size={14} className="text-text-tertiary" />
                  )}
                </div>
                <div>
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent ? "text-text-primary font-medium" : "text-text-secondary",
                    )}
                  >
                    {step.label}
                  </span>
                  {isCurrent && (
                    <p className="text-[10px] text-text-tertiary mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {status === "in_progress" && progress !== undefined && (
        <div className="mb-3">
          <div className="h-1.5 bg-bg-tertiary w-full">
            <div
              className="h-full bg-accent-primary transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-tertiary mt-1 block">
            {Math.round(progress)}%
          </span>
        </div>
      )}

      {statusMessage && (
        <p
          className={cn(
            "text-[10px] font-mono mb-3",
            status === "error" ? "text-status-error" : "text-text-tertiary",
          )}
        >
          {statusMessage}
        </p>
      )}

      <div className="flex gap-2">
        {status === "in_progress" && onCancel ? (
          <>
            <Button variant="secondary" size="sm" loading>
              Calibrating…
            </Button>
            <Button variant="danger" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={onStart}>
            {status === "success" ? "Re-calibrate" : status === "error" ? "Retry" : "Start"}
          </Button>
        )}
      </div>
    </div>
  );
}
