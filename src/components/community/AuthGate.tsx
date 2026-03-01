"use client";

import { useAuthStore } from "@/stores/auth-store";

interface AuthGateProps {
  children: React.ReactNode;
  action?: string;
  onSignIn?: () => void;
}

function requestSignIn() {
  window.dispatchEvent(new CustomEvent("open-signin"));
}

export function AuthGate({ children, action = "continue", onSignIn }: AuthGateProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm text-text-tertiary">
          <button
            onClick={onSignIn ?? requestSignIn}
            className="text-accent-primary hover:underline"
          >
            Sign in
          </button>
          {" "}to {action}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
