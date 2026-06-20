"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isScriptUnlocked, getSelectedHook } from "@/lib/script-access";
import {
  generateScript,
  getTimeline,
  type NichePreset,
  type ScriptGenerationResponse,
  type ScriptAnnotation,
} from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  visual: "#f59e0b",
  auditory: "#3b82f6",
  language: "#10b981",
  motion: "#ef4444",
  default_mode: "#8b5cf6",
};

type TextSegment = { text: string; annotation: ScriptAnnotation | null };

function buildHighlightedSegments(
  fullText: string,
  annotations: ScriptAnnotation[],
  side: "original" | "improved"
): TextSegment[] {
  const key = side === "original" ? "original_text" : "improved_text";
  const matches: { start: number; end: number; annotation: ScriptAnnotation }[] = [];

  for (const a of annotations) {
    const needle = a[key];
    if (!needle) continue;
    const idx = fullText.indexOf(needle);
    if (idx === -1) continue;
    matches.push({ start: idx, end: idx + needle.length, annotation: a });
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      segments.push({ text: fullText.slice(cursor, m.start), annotation: null });
    }
    segments.push({ text: fullText.slice(m.start, m.end), annotation: m.annotation });
    cursor = m.end;
  }
  if (cursor < fullText.length) {
    segments.push({ text: fullText.slice(cursor), annotation: null });
  }
  return segments;
}

function primaryNetworkColor(annotation: ScriptAnnotation): string {
  return NETWORK_COLORS[annotation.target_networks[0]] || "#6b7280";
}

function HighlightedText({
  segments,
  side,
  activeAnnotation,
  onHoverAnnotation,
}: {
  segments: TextSegment[];
  side: "original" | "improved";
  activeAnnotation: ScriptAnnotation | null;
  onHoverAnnotation: (a: ScriptAnnotation | null) => void;
}) {
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.annotation) {
          return <span key={i}>{seg.text}</span>;
        }
        const color = primaryNetworkColor(seg.annotation);
        const isActive = activeAnnotation === seg.annotation;
        return (
          <span
            key={i}
            className="relative cursor-pointer rounded px-0.5 transition-all duration-150"
            style={{
              backgroundColor: `${color}${isActive ? "30" : "18"}`,
              borderBottom: `2px solid ${color}`,
              textDecoration: side === "original" ? "line-through" : "none",
              textDecorationColor: side === "original" ? `${color}80` : undefined,
            }}
            onMouseEnter={() => onHoverAnnotation(seg.annotation)}
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {seg.text}
            {isActive && (
              <span
                className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-xs shadow-xl"
                style={{ borderColor: `${color}60` }}
              >
                <span className="mb-1.5 flex flex-wrap gap-1">
                  {seg.annotation.target_networks.map((net) => (
                    <span
                      key={net}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: NETWORK_COLORS[net] || "#6b7280" }}
                    >
                      {net.replace("_", " ")}
                    </span>
                  ))}
                </span>
                <span className="block text-[var(--text-secondary)]">
                  {seg.annotation.reason}
                </span>
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function SideBySideDisplay({
  originalText,
  result,
}: {
  originalText: string;
  result: ScriptGenerationResponse;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [activeAnnotation, setActiveAnnotation] = useState<ScriptAnnotation | null>(null);

  const handleScroll = useCallback((source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      const ratio = from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight || 1);
    }
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  const originalSegments = buildHighlightedSegments(originalText, result.annotations, "original");
  const improvedSegments = buildHighlightedSegments(result.improved_script, result.annotations, "improved");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Side-by-Side Comparison</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(NETWORK_COLORS).map(([net, color]) => (
            <span key={net} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {net.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Original Transcript</p>
          <div
            ref={leftRef}
            onScroll={() => handleScroll("left")}
            className="h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            <HighlightedText
              segments={originalSegments}
              side="original"
              activeAnnotation={activeAnnotation}
              onHoverAnnotation={setActiveAnnotation}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Improved Script</p>
          <div
            ref={rightRef}
            onScroll={() => handleScroll("right")}
            className="h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-sm leading-relaxed text-[var(--text-primary)]"
          >
            <HighlightedText
              segments={improvedSegments}
              side="improved"
              activeAnnotation={activeAnnotation}
              onHoverAnnotation={setActiveAnnotation}
            />
          </div>
        </div>
      </div>

      {result.annotations.length > 0 && (
        <p className="text-xs text-[var(--text-secondary)]">
          {result.annotations.length} change{result.annotations.length !== 1 ? "s" : ""} highlighted — hover any colored segment to see the network annotation
        </p>
      )}
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
          <SideBySideDisplay originalText={transcript} result={result} />

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
