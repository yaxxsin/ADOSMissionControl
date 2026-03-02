"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { ItemCard } from "./ItemCard";
import { ItemSubmitForm } from "./ItemSubmitForm";
import type { CommunityItem, ItemType } from "@/lib/community-types";

type SortMode = "top" | "newest";

export function ItemList() {
  const [type, setType] = useState<ItemType>("feature");
  const [sort, setSort] = useState<SortMode>("top");
  const [submitOpen, setSubmitOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const items = useQuery(communityApi.items.list, { type, sort });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        {/* Type tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setType("feature")}
            className={cn(
              "px-3 py-1 text-sm rounded transition-colors",
              type === "feature"
                ? "bg-accent-primary/10 text-accent-primary"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            Features
          </button>
          <button
            onClick={() => setType("bug")}
            className={cn(
              "px-3 py-1 text-sm rounded transition-colors",
              type === "bug"
                ? "bg-status-error/10 text-status-error"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            Bugs
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setSort("top")}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                sort === "top"
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              Top
            </button>
            <button
              onClick={() => setSort("newest")}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                sort === "newest"
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              Newest
            </button>
          </div>

          {/* Submit button */}
          {isAuthenticated ? (
            <button
              onClick={() => setSubmitOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-sm font-medium bg-accent-primary text-bg-primary rounded hover:bg-accent-primary/90 transition-colors"
            >
              <Plus size={12} />
              Submit
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-signin"))}
              className="px-2 py-1 text-sm text-accent-primary hover:underline"
            >
              Sign in to submit
            </button>
          )}
        </div>
      </div>

      {items === undefined ? (
        <div className="text-sm text-text-tertiary text-center py-8">
          Loading requests...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-text-tertiary text-center py-8">
          No {type === "feature" ? "feature requests" : "bug reports"} yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: CommunityItem) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      )}

      {submitOpen && (
        <ItemSubmitForm
          defaultType={type}
          onClose={() => setSubmitOpen(false)}
        />
      )}
    </div>
  );
}
