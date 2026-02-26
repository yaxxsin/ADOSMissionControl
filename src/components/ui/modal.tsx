"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={cn("bg-bg-secondary border border-border-default w-full mx-4", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-default">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
