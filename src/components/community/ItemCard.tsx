"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useQuery } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { formatDate } from "@/lib/utils";
import { UpvoteButton } from "./UpvoteButton";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import type { CommunityItem } from "@/lib/community-types";

interface ItemCardProps {
  item: CommunityItem;
}

export function ItemCard({ item }: ItemCardProps) {
  const commentCount = useQuery(communityApi.comments.count, {
    targetType: "community_item",
    targetId: item._id,
  });

  return (
    <div className="flex items-start gap-3 p-3 bg-bg-secondary border border-border-default rounded hover:border-border-hover transition-colors">
      <UpvoteButton itemId={item._id} count={item.upvoteCount} />

      <Link href={`/community/requests/${item._id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {item.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          <CategoryBadge category={item.category} />
          {commentCount !== undefined && commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-text-tertiary">
              <MessageSquare size={10} />
              {commentCount}
            </span>
          )}
          <span className="text-xs text-text-tertiary">
            {formatDate(item._creationTime)}
          </span>
        </div>
      </Link>
    </div>
  );
}
