"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";

interface FcDisconnectedPlaceholderProps {
  droneName: string;
}

export function FcDisconnectedPlaceholder({ droneName }: FcDisconnectedPlaceholderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
      <WifiOff size={32} className="text-text-tertiary" />
      <p className="text-sm text-text-secondary">
        Connect to <span className="font-semibold text-text-primary">{droneName}</span> to configure
      </p>
      <p className="text-xs text-text-tertiary max-w-xs text-center">
        Flight controller settings require an active connection. Go to Connect to establish a link.
      </p>
      <Link
        href="/connect"
        className="mt-2 px-4 py-2 text-xs font-semibold bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors"
      >
        Go to Connect
      </Link>
    </div>
  );
}
