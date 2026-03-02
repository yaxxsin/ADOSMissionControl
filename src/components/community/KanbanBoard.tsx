"use client";

import { useQuery, useMutation } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { KanbanColumn } from "./KanbanColumn";
import type { CommunityItem, ItemStatus } from "@/lib/community-types";

const columns: ItemStatus[] = [
  "backlog",
  "in_discussion",
  "planned",
  "in_progress",
  "released",
  "wont_do",
];

export function KanbanBoard() {
  const grouped = useQuery(communityApi.items.listByStatus, {});
  const updateStatus = useMutation(communityApi.items.updateStatus);

  const handleDrop = (itemId: string, status: ItemStatus) => {
    updateStatus({ id: itemId as never, status });
  };

  if (grouped === undefined) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
        Loading board...
      </div>
    );
  }

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-min">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={(grouped[status] || []) as CommunityItem[]}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
