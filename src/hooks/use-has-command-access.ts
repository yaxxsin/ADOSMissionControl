"use client";

import { useQuery } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { useConvexAvailable } from "@/app/ConvexClientProvider";

export function useHasCommandAccess(): {
  hasAccess: boolean;
  isLoading: boolean;
  profile: Record<string, unknown> | null;
} {
  const convexAvailable = useConvexAvailable();
  const profile = useQuery(
    communityApi.profiles.getMyProfile,
    convexAvailable ? {} : "skip"
  );

  if (!convexAvailable) return { hasAccess: false, isLoading: false, profile: null };
  if (profile === undefined) return { hasAccess: false, isLoading: true, profile: null };
  if (profile === null) return { hasAccess: false, isLoading: false, profile: null };

  const hasAccess = profile.role === "admin" || profile.role === "alpha_tester";
  return { hasAccess, isLoading: false, profile };
}
