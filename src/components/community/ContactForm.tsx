"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { communityApi } from "@/lib/community-api";

export function ContactForm() {
  const submit = useMutation(communityApi.contact.submit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Name, email, and message are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await submit({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        source: "command-community",
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-xs text-status-success bg-status-success/10 px-4 py-3 rounded">
          <p className="font-medium">Message sent.</p>
          <p className="mt-1 text-status-success/80">
            We&apos;ll get back to you as soon as we can.
          </p>
        </div>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-sm font-medium text-text-primary mb-1">Contact</h1>
      <p className="text-xs text-text-tertiary mb-6">
        Send a message to the Altnautica team.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="text-xs text-status-error bg-status-error/10 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={200}
            className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">
            Subject{" "}
            <span className="text-text-tertiary/60">(optional)</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
            maxLength={200}
            className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="Your message..."
            className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-y"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium bg-accent-primary text-bg-primary rounded hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </div>
      </form>
    </div>
  );
}
