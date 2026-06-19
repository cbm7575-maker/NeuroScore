"use client";

import { useCallback, useState } from "react";
import type { AnalysisResponse, HookOption } from "@/lib/api";
import { generateHooks } from "@/lib/api";

interface HooksTabProps {
  videoId: string;
  analysisResult: AnalysisResponse;
  onGenerateScript: (hookText: string) => void;
}

export default function HooksTab({
  videoId,
  analysisResult,
  onGenerateScript,
}: HooksTabProps) {
  const [hooks, setHooks] = useState<HookOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedHook, setEditedHook] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const niche = "general";

  const handleGenerate = useCallback(async () => {
    setError(null);
    setLoading(true);
    setSelectedIndex(null);
    setEditedHook("");
    try {
      const result = await generateHooks(videoId, niche);
      setHooks(result.hooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hook generation failed");
    } finally {
      setLoading(false);
    }
  }, [videoId, niche]);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setEditedHook(hooks[index].hook_text);
  };

  const hasSelection = selectedIndex !== null && editedHook.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Generate Hooks
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          AI-generated hook options based on your neural engagement analysis
        </p>
      </div>

      {/* Generate hooks button */}
      {hooks.length === 0 && !loading && (
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
          Generate Hook Options
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--bg-tertiary)] border-t-[var(--accent)]" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            Generating hook options from neural analysis...
          </p>
        </div>
      )}

      {/* Hook options */}
      {hooks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Hook Options
            </h3>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
          <div className="grid gap-3">
            {hooks.map((hook, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${
                  selectedIndex === i
                    ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                      selectedIndex === i
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <span className="leading-relaxed">{hook.hook_text}</span>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {hook.explanation}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hook editor */}
      {selectedIndex !== null && (
        <div className="space-y-2">
          <label className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Edit Hook
          </label>
          <textarea
            value={editedHook}
            onChange={(e) => setEditedHook(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 transition-colors focus:border-[var(--accent)] focus:outline-none"
            placeholder="Edit your hook text..."
          />
        </div>
      )}

      {/* Generate script button */}
      <div className="border-t border-[var(--border)] pt-6">
        <button
          onClick={() => onGenerateScript(editedHook)}
          disabled={!hasSelection}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          Generate Script
        </button>
        {!hasSelection && hooks.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Select a hook above to enable script generation
          </p>
        )}
      </div>
    </div>
  );
}
