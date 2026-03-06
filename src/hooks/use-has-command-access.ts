"use client";

import { useQuery } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { isDemoMode } from "@/lib/utils";

export function useHasCommandAccess(): {
  hasAccess: boolean;
  isLoading: boolean;
  profile: Record<string, unknown> | null;
} {
  const demo = isDemoMode();
  const convexAvailable = useConvexAvailable();
  const profile = useQuery(
    communityApi.profiles.getMyProfile,
    !demo && convexAvailable ? {} : "skip"
  );

  if (demo) return { hasAccess: true, isLoading: false, profile: null };

  if (!convexAvailable) return { hasAccess: false, isLoading: false, profile: null };
  if (profile === undefined) return { hasAccess: false, isLoading: true, profile: null };
  if (profile === null) return { hasAccess: false, isLoading: false, profile: null };

  const hasAccess = profile.role === "admin" || profile.role === "alpha_tester";
  return { hasAccess, isLoading: false, profile };
}
