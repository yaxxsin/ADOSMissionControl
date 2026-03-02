"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ChangelogEntry } from "./ChangelogEntry";
import { ChangelogEditor } from "./ChangelogEditor";
import type { ChangelogEntry as ChangelogEntryType } from "@/lib/community-types";

export function ChangelogTimeline() {
  const entries = useQuery(communityApi.changelog.list, {});
  const removeChangelog = useMutation(communityApi.changelog.remove);
  const isAdmin = useIsAdmin();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntryType | undefined>();

  const handleEdit = (entry: ChangelogEntryType) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    removeChangelog({ id: id as never });
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingEntry(undefined);
  };

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
        Loading changelog...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Changelog</h2>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingEntry(undefined);
              setEditorOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-sm font-medium bg-accent-primary text-bg-primary rounded hover:bg-accent-primary/90 transition-colors"
          >
            <Plus size={12} />
            New Release
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">
          No changelog entries yet.
        </p>
      ) : (
        <div className="ml-1">
          {entries.map((entry: ChangelogEntryType) => (
            <ChangelogEntry
              key={entry._id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <ChangelogEditor entry={editingEntry} onClose={handleCloseEditor} />
      )}
    </div>
  );
}
