/**
 * @module ChangelogNotificationGate
 * @description Guards the changelog notification modal behind Convex availability.
 * Prevents useQuery from being called without a ConvexReactClient parent.
 * Wrapped in an error boundary so changelog failures never crash the app.
 * @license GPL-3.0-only
 */

"use client";

import { Component, type ReactNode } from "react";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { ChangelogNotificationModal } from "./ChangelogNotificationModal";

/** Silent error boundary — logs and renders nothing on failure. */
class ChangelogErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[changelog-notification] Silently caught error:", error.message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function ChangelogNotificationInner() {
  const convexAvailable = useConvexAvailable();

  if (!convexAvailable) return null;

  return <ChangelogNotificationModal />;
}

export function ChangelogNotificationGate() {
  return (
    <ChangelogErrorBoundary>
      <ChangelogNotificationInner />
    </ChangelogErrorBoundary>
  );
}
