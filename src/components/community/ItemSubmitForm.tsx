"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { Select } from "@/components/ui/select";
import type { ItemType, ItemCategory } from "@/lib/community-types";

const categories: { value: ItemCategory; label: string }[] = [
  { value: "command", label: "Command GCS" },
  { value: "ados", label: "ADOS" },
  { value: "website", label: "Website" },
  { value: "general", label: "General" },
];

interface ItemSubmitFormProps {
  defaultType?: ItemType;
  onClose: () => void;
}

export function ItemSubmitForm({ defaultType = "feature", onClose }: ItemSubmitFormProps) {
  const createItem = useMutation(communityApi.items.create);
  const [type, setType] = useState<ItemType>(defaultType);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ItemCategory>("command");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and description are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await createItem({
        type,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Not authenticated")) {
        setError("Please sign in to submit a request.");
      } else if (msg.includes("Profile required")) {
        setError("Please sign in again to create your profile.");
      } else {
        setError("Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-default rounded w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-medium text-text-primary">Submit Request</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-status-error bg-status-error/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] text-text-tertiary block mb-1">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("feature")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  type === "feature"
                    ? "bg-accent-primary text-bg-primary"
                    : "bg-bg-primary text-text-secondary border border-border-default"
                }`}
              >
                Feature Request
              </button>
              <button
                type="button"
                onClick={() => setType("bug")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  type === "bug"
                    ? "bg-status-error text-bg-primary"
                    : "bg-bg-primary text-text-secondary border border-border-default"
                }`}
              >
                Bug Report
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-text-tertiary block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary"
              maxLength={200}
              className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="text-[10px] text-text-tertiary block mb-1">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="Describe what you need or what went wrong..."
              className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-y"
            />
          </div>

          <div>
            <label className="text-[10px] text-text-tertiary block mb-1">Category</label>
            <Select
              options={categories}
              value={category}
              onChange={(v) => setCategory(v as ItemCategory)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium bg-accent-primary text-bg-primary rounded hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
