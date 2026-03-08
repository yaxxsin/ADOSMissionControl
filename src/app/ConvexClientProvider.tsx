"use client";

import { ReactNode, createContext, useContext, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { AuthBridge } from "@/components/auth/AuthBridge";
import { SilentErrorBoundary } from "@/components/ui/SilentErrorBoundary";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const ConvexAvailableContext = createContext(false);
export const useConvexAvailable = () => useContext(ConvexAvailableContext);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const client = useMemo(() => {
    if (!CONVEX_URL) return null;
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  if (!client) {
    // Pure local mode — no Convex, no auth
    return (
      <ConvexAvailableContext.Provider value={false}>
        {children}
      </ConvexAvailableContext.Provider>
    );
  }

  return (
    <ConvexAvailableContext.Provider value={true}>
      <ConvexAuthNextjsProvider client={client}>
        <SilentErrorBoundary label="auth-bridge">
          <AuthBridge />
        </SilentErrorBoundary>
        {children}
      </ConvexAuthNextjsProvider>
    </ConvexAvailableContext.Provider>
  );
}
