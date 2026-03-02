"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { formatDate } from "@/lib/utils";
import { UpvoteButton } from "./UpvoteButton";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { AdminItemControls } from "./AdminItemControls";
import { CommunityComments } from "./CommunityComments";
import type { CommunityItem } from "@/lib/community-types";

interface ItemDetailProps {
  id: string;
}

export function ItemDetail({ id }: ItemDetailProps) {
  const item = useQuery(communityApi.items.get, { id: id as never });

  if (item === undefined) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
        Loading...
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <p className="text-sm text-text-tertiary">Item not found</p>
        <Link
          href="/community/requests"
          className="text-sm text-accent-primary hover:underline"
        >
          Back to requests
        </Link>
      </div>
    );
  }

  const typedItem = item as CommunityItem;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link
        href="/community/requests"
        className="flex items-center gap-1 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <ArrowLeft size={12} />
        Back to requests
      </Link>

      <div className="flex items-start gap-3">
        <UpvoteButton itemId={typedItem._id} count={typedItem.upvoteCount} />

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h1 className="text-lg font-medium text-text-primary mb-2">
              {typedItem.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={typedItem.status} />
              <CategoryBadge category={typedItem.category} />
              <span className="text-xs text-text-tertiary">
                by {typedItem.authorName || "Unknown"}
              </span>
              <span className="text-xs text-text-tertiary">
                {formatDate(typedItem._creationTime)}
              </span>
              {typedItem.type === "bug" && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-status-error/10 text-status-error rounded">
                  Bug
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed bg-bg-secondary border border-border-default rounded p-3">
            {typedItem.body}
          </div>

          {typedItem.eta && (
            <p className="text-xs text-text-tertiary">
              ETA: {typedItem.eta}
            </p>
          )}

          {typedItem.resolvedVersion && (
            <p className="text-xs text-text-tertiary">
              Resolved in {typedItem.resolvedVersion}
            </p>
          )}

          <AdminItemControls
            itemId={typedItem._id}
            currentStatus={typedItem.status}
            currentPriority={typedItem.priority}
            currentEta={typedItem.eta}
            currentResolvedVersion={typedItem.resolvedVersion}
          />

          <CommunityComments
            targetType="community_item"
            targetId={typedItem._id}
          />
        </div>
      </div>
    </div>
  );
}
