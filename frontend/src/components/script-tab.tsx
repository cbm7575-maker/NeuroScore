"use client";

import { useCallback, useState } from "react";
import {
  generateScript,
  getTimeline,
  type NichePreset,
  type ScriptAnnotation,
  type ScriptGenerationResponse,
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

interface ScriptTabProps {
  videoId: string;
  selectedHook: string;
  niche: NichePreset;
  onNavigateToAnalysis: () => void;
}

export default function ScriptTab({
  videoId,
  selectedHook,
  niche,
  onNavigateToAnalysis,
}: ScriptTabProps) {
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ScriptGenerationResponse | null>(null);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentScript = editedScript ?? result?.improved_script ?? "";
  const isEdited = editedScript !== null && editedScript !== result?.improved_script;

  const handleGenerate = useCallback(async () => {
    if (!transcript.trim()) {
      setError("Please paste your video transcript before generating.");
      return;
    }

    setLoading(true);
    setError(null);
    setEditedScript(null);

    try {
      const timelineResult = await getTimeline(videoId);
      const response = await generateScript({
        video_id: videoId,
        hook: selectedHook,
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
  }, [videoId, selectedHook, niche, transcript]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(currentScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentScript]);

  const handleResetEdits = useCallback(() => {
    setEditedScript(null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Script</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          AI-improved script based on your neural engagement data
        </p>
      </div>

      {/* Selected hook display */}
      <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          Selected hook
        </p>
        <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
          {selectedHook}
        </p>
      </div>

      {/* Transcript input (pre-generation) */}
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
              placeholder="Paste your video script or transcript here..."
              rows={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !transcript.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {loading ? "Generating..." : "Generate improved script"}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            Analyzing neural drop-offs and rewriting script...
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            This may take 30-60 seconds
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Generated script result */}
      {result && !loading && (
        <>
          {/* Editable script */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Improved Script</h3>
                {isEdited && (
                  <span className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                    Edited
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEdited && (
                  <button
                    onClick={handleResetEdits}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    Reset
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                >
                  {copied ? (
                    <>
                      <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
            <textarea
              value={currentScript}
              onChange={(e) => setEditedScript(e.target.value)}
              rows={Math.max(12, currentScript.split("\n").length + 2)}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Edit the script directly above. Your changes are preserved while annotations show the AI&apos;s original suggestions.
            </p>
          </div>

          {/* Annotations */}
          {result.annotations.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Neural Changes ({result.annotations.length})
              </h3>
              <p className="mb-3 text-xs text-[var(--text-secondary)]">
                Each change targets specific brain networks that showed drop-offs in your video
              </p>
              <div className="space-y-3">
                {result.annotations.map((a, i) => (
                  <AnnotationCard key={i} annotation={a} />
                ))}
              </div>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setResult(null);
                setEditedScript(null);
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)]/30 hover:text-[var(--text-primary)]"
            >
              Regenerate
            </button>
          </div>

          {/* Re-shoot guidance (Issue #124) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                </svg>
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Ready to re-shoot?
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Your improved script is ready. Here&apos;s what to do next:
                  </p>
                  <ol className="list-inside space-y-1.5 text-sm text-[var(--text-secondary)]">
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">1</span>
                      <span><strong className="text-[var(--text-primary)]">Copy your script</strong> using the Copy button above{isEdited ? " (includes your edits)" : ""}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">2</span>
                      <span><strong className="text-[var(--text-primary)]">Re-shoot your video</strong> using the improved script</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">3</span>
                      <span><strong className="text-[var(--text-primary)]">Upload the new version</strong> on the Analysis tab to compare neural scores</span>
                    </li>
                  </ol>
                </div>
                <button
                  onClick={onNavigateToAnalysis}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Go to Analysis Tab to Re-upload
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
