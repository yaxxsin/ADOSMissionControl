"use client";

import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";
import type { CommunityItem, ItemStatus } from "@/lib/community-types";

const statusLabels: Record<ItemStatus, string> = {
  backlog: "Backlog",
  in_discussion: "In Discussion",
  planned: "Planned",
  in_progress: "In Progress",
  released: "Released",
  wont_do: "Won't Do",
};

interface KanbanColumnProps {
  status: ItemStatus;
  items: CommunityItem[];
  onDrop: (itemId: string, status: ItemStatus) => void;
}

export function KanbanColumn({ status, items, onDrop }: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    if (itemId) {
      onDrop(itemId, status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col min-w-[200px] max-w-[240px] bg-bg-secondary rounded border border-border-default",
        "transition-colors"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {statusLabels[status]}
        </span>
        <span className="text-xs font-mono text-text-tertiary">
          {items.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {items.map((item) => (
          <KanbanCard key={item._id} item={item} />
        ))}
        {items.length === 0 && (
          <p className="text-xs text-text-tertiary text-center py-4">
            No items
          </p>
        )}
      </div>
    </div>
  );
}
