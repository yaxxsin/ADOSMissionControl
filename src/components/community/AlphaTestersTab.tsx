"use client";

/**
 * @module AlphaTestersTab
 * @description Admin-only tab for managing alpha tester applications.
 * Lists all users who applied for alpha access, with approve/reject actions.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { Check, X, Loader2 } from "lucide-react";

type Filter = "all" | "pending" | "approved";

interface AlphaProfile {
  _id: string;
  _creationTime: number;
  fullName?: string;
  email?: string;
  role: string;
  alphaAppliedAt?: number;
}

export function AlphaTestersTab() {
  const applications = useQuery(communityApi.profiles.listAlphaApplications) as AlphaProfile[] | undefined;
  const updateRole = useMutation(communityApi.profiles.updateRole);
  const [filter, setFilter] = useState<Filter>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (applications === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const filtered = applications.filter((p) => {
    if (filter === "pending") return p.role !== "alpha_tester" && p.role !== "admin";
    if (filter === "approved") return p.role === "alpha_tester";
    return true;
  });

  const pendingCount = applications.filter(
    (p) => p.role !== "alpha_tester" && p.role !== "admin"
  ).length;
  const approvedCount = applications.filter(
    (p) => p.role === "alpha_tester"
  ).length;

  async function handleApprove(profileId: string) {
    setLoadingId(profileId);
    try {
      await updateRole({ profileId: profileId as never, role: "alpha_tester" });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(profileId: string) {
    setLoadingId(profileId);
    try {
      await updateRole({ profileId: profileId as never, role: "rejected" });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">
          Alpha Tester Applications
        </h2>
        <div className="flex items-center gap-1">
          {(["all", "pending", "approved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                filter === f
                  ? "bg-accent-primary text-white"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {f === "all"
                ? `All (${applications.length})`
                : f === "pending"
                  ? `Pending (${pendingCount})`
                  : `Approved (${approvedCount})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-tertiary text-xs">
          No applications found.
        </div>
      ) : (
        <div className="border border-border-default rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-tertiary text-text-secondary">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Applied</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => {
                const isApproved = profile.role === "alpha_tester";
                const isAdmin = profile.role === "admin";
                const isLoading = loadingId === profile._id;

                return (
                  <tr
                    key={profile._id}
                    className="border-t border-border-default hover:bg-bg-secondary/50"
                  >
                    <td className="px-3 py-2 text-text-primary">
                      {profile.fullName || "—"}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {profile.email || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isApproved
                            ? "bg-green-500/10 text-green-400"
                            : isAdmin
                              ? "bg-accent-primary/10 text-accent-primary"
                              : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {profile.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">
                      {profile.alphaAppliedAt
                        ? new Date(profile.alphaAppliedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <span className="text-text-tertiary text-[10px]">
                          Admin
                        </span>
                      ) : isApproved ? (
                        <span className="text-green-400 text-[10px]">
                          Approved
                        </span>
                      ) : isLoading ? (
                        <Loader2
                          size={12}
                          className="inline animate-spin text-text-tertiary"
                        />
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleApprove(profile._id)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-green-400 hover:bg-green-500/10 rounded transition-colors"
                          >
                            <Check size={10} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(profile._id)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-status-error hover:bg-red-500/10 rounded transition-colors"
                          >
                            <X size={10} />
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
