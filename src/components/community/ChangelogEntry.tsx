"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { ChangelogEntry as ChangelogEntryType } from "@/lib/community-types";

interface ChangelogEntryProps {
  entry: ChangelogEntryType;
  onEdit?: (entry: ChangelogEntryType) => void;
  onDelete?: (id: string) => void;
}

export function ChangelogEntry({ entry, onEdit, onDelete }: ChangelogEntryProps) {
  const isAdmin = useIsAdmin();

  return (
    <div className="relative pl-6 pb-6 border-l border-border-default last:border-l-0">
      {/* Timeline dot */}
      <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-accent-primary border-2 border-bg-primary" />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-accent-primary/10 text-accent-primary rounded">
              {entry.version}
            </span>
            {entry.repo && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono text-text-secondary bg-bg-tertiary rounded">
                {entry.repo}
              </span>
            )}
            {entry.commitUrl && (
              <a
                href={entry.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-accent-primary hover:underline"
              >
                {entry.commitSha?.slice(0, 7)}
              </a>
            )}
            <h3 className="text-sm font-medium text-text-primary">{entry.title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-text-tertiary">
              {formatDate(entry.commitDate ?? entry.publishedAt)}
            </span>
            {isAdmin && onEdit && onDelete && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => onEdit(entry)}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => onDelete(entry._id)}
                  className="text-text-tertiary hover:text-status-error transition-colors"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {entry.bodyHtml ? (
          <div
            className="text-xs text-text-secondary leading-relaxed changelog-body"
            dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
          />
        ) : (
          <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
            {entry.body}
          </div>
        )}

        {entry.tags && entry.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] text-text-tertiary bg-bg-tertiary rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
