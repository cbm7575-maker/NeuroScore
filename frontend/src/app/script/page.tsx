"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isScriptUnlocked, getSelectedHook } from "@/lib/script-access";
import {
  generateScript,
  getTimeline,
  type NichePreset,
  type ScriptGenerationResponse,
  type ScriptAnnotation,
  type TimelineEntry,
} from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  visual: "#f59e0b",
  auditory: "#3b82f6",
  language: "#10b981",
  motion: "#ef4444",
  default_mode: "#8b5cf6",
};

function AnnotationCard({ annotation }: { annotation: ScriptAnnotation }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {annotation.target_networks.map((net) => (
          <span
            key={net}
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: NETWORK_COLORS[net] || "#6b7280" }}
          >
            {net.replace("_", " ")}
          </span>
        ))}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
            Original
          </p>
          <p className="rounded bg-red-500/10 px-2 py-1 text-[var(--text-secondary)] line-through">
            {annotation.original_text}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
            Improved
          </p>
          <p className="rounded bg-green-500/10 px-2 py-1 text-[var(--text-primary)]">
            {annotation.improved_text}
          </p>
        </div>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{annotation.reason}</p>
    </div>
  );
}

export default function ScriptPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [hook, setHook] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ScriptGenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnlocked(isScriptUnlocked());
    setHook(getSelectedHook());
  }, []);

  if (unlocked === null) return null;

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg
          className="mb-6 h-12 w-12 text-[var(--text-secondary)]/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <h2 className="text-xl font-semibold">Script not yet generated</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          Select a hook on the Hooks tab and click{" "}
          <strong>Generate script</strong> to unlock this page.
        </p>
        <Link
          href="/hooks"
          className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Go to Hooks
        </Link>
      </div>
    );
  }

  async function handleGenerate() {
    const videoId = sessionStorage.getItem("neuroscore_video_id");
    const niche =
      (sessionStorage.getItem("neuroscore_niche") as NichePreset) || "default";

    if (!videoId) {
      setError("No video found. Please go back to Analysis and upload a video.");
      return;
    }
    if (!hook) {
      setError("No hook selected. Please go back to Hooks and select one.");
      return;
    }
    if (!transcript.trim()) {
      setError("Please paste your video transcript before generating.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timelineResult = await getTimeline(videoId);
      const response = await generateScript({
        video_id: videoId,
        hook,
        transcript: transcript.trim(),
        niche,
        timeline: timelineResult.timeline,
      });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Script generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Script</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          AI-improved script based on your neural engagement data.
        </p>
      </div>

      {hook && (
        <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Selected hook
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
            {hook}
          </p>
        </div>
      )}

      {!result && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="transcript"
              className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
            >
              Your video transcript
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your video script or transcript here…"
              rows={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !transcript.trim()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Generating…" : "Generate improved script"}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            Analyzing neural drop-offs and rewriting script…
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <>
          <div>
            <h3 className="mb-3 text-lg font-semibold">Improved Script</h3>
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">
              {result.improved_script}
            </div>
          </div>

          {result.annotations.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Changes ({result.annotations.length})
              </h3>
              <div className="space-y-3">
                {result.annotations.map((a, i) => (
                  <AnnotationCard key={i} annotation={a} />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setResult(null)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)]/30"
            >
              Regenerate
            </button>
            <Link
              href="/"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)]/30"
            >
              Back to Analysis
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
