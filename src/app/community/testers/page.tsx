"use client";

import { AlphaTestersTab } from "@/components/community/AlphaTestersTab";
import { useIsAdmin } from "@/hooks/use-is-admin";

export default function TestersPage() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        Admin access required
      </div>
    );
  }

  return <AlphaTestersTab />;
}
