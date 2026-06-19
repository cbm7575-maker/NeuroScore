"use client";

import { useCallback, useRef, useState } from "react";
import {
  generateHooks,
  type AnalysisResponse,
  type HookGenerationResponse,
  type HookOption,
} from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  Visual: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Auditory: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Attention: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Salience: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "Default Mode": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function NetworkBadge({ name }: { name: string }) {
  const color =
    NETWORK_COLORS[name] ??
    "bg-gray-500/15 text-gray-400 border-gray-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {name}
    </span>
  );
}

function ScoreBar({ network, score }: { network: string; score: number }) {
  const isWeak = score < 50;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 truncate text-xs text-[var(--text-secondary)]">
        {network}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={`h-full rounded-full transition-all ${isWeak ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span
        className={`w-10 text-right text-xs font-medium ${isWeak ? "text-rose-400" : "text-emerald-400"}`}
      >
        {score}
      </span>
    </div>
  );
}

function HookCard({
  hook,
  index,
  selected,
  edited,
  displayText,
  onSelect,
}: {
  hook: HookOption;
  index: number;
  selected: boolean;
  edited: boolean;
  displayText: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-5 text-left transition-all ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                selected
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent)]/15 text-[var(--accent)]"
              }`}
            >
              {index + 1}
            </span>
            {edited && (
              <span className="rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                Edited
              </span>
            )}
          </div>
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--border)]"
            }`}
          >
            {selected && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10.28 2.28a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L4.25 7.22l4.97-4.94a.75.75 0 0 1 1.06 0z" />
              </svg>
            )}
          </div>
        </div>

        <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-sm leading-relaxed text-[var(--text-primary)]">
          &ldquo;{displayText}&rdquo;
        </blockquote>

        <div className="flex flex-wrap gap-1.5">
          {hook.target_networks.map((net) => (
            <NetworkBadge key={net} name={net} />
          ))}
        </div>

        {hook.neural_weaknesses_addressed.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Weaknesses Addressed
            </p>
            <ul className="space-y-0.5">
              {hook.neural_weaknesses_addressed.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                  <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg bg-[var(--bg-tertiary)] p-2.5">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Strategy: </span>
            {hook.explanation}
          </p>
        </div>
      </div>
    </button>
  );
}

interface HooksTabProps {
  videoId: string;
  analysisResult: AnalysisResponse;
  niche?: string;
  onGenerateScript?: (hookText: string) => void;
}

export default function HooksTab({
  videoId,
  analysisResult,
  niche = "general",
  onGenerateScript,
}: HooksTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HookGenerationResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const editorRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setLoading(true);
    setSelectedIndex(null);
    setEditedTexts({});
    try {
      const res = await generateHooks(videoId, niche);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hook generation failed");
    } finally {
      setLoading(false);
    }
  }, [videoId, niche]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      if (selectedIndex === null) return;
      setEditedTexts((prev) => ({ ...prev, [selectedIndex]: text }));
    },
    [selectedIndex]
  );

  const getDisplayText = (index: number): string => {
    if (editedTexts[index] !== undefined) return editedTexts[index];
    if (result) return result.hooks[index].hook_text;
    return "";
  };

  const hooks = result?.hooks ?? [];
  const selectedHook = selectedIndex !== null ? hooks[selectedIndex] : null;
  const currentText = selectedIndex !== null ? getDisplayText(selectedIndex) : "";
  const hasSelection = selectedIndex !== null && currentText.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Generate Hooks
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            AI-generated hook options based on your video&apos;s neural engagement data
          </p>
        </div>
        {hooks.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            Regenerate
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Initial state */}
      {!result && !loading && !error && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <svg className="h-6 w-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Generate AI-powered hook options using neural analysis data for video{" "}
            <span className="font-mono text-[var(--accent)]">{videoId.slice(0, 8)}</span>
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Generate Hook Options
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--bg-tertiary)] border-t-[var(--accent)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Analyzing opening neural data and generating hooks…
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            This may take 15–30 seconds
          </p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Opening neural summary */}
          <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Opening Neural Profile (first 5 seconds)
            </h3>
            <div className="space-y-2">
              {Object.entries(result.opening_scores).map(([net, score]) => (
                <ScoreBar key={net} network={net} score={score} />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.neural_weaknesses.length > 0 && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                  <p className="mb-1.5 text-xs font-medium text-rose-400">
                    Weaknesses to fix
                  </p>
                  <ul className="space-y-1">
                    {result.neural_weaknesses.map((w, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)]">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.neural_strengths.length > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="mb-1.5 text-xs font-medium text-emerald-400">
                    Strengths to preserve
                  </p>
                  <ul className="space-y-1">
                    {result.neural_strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)]">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Hook option cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Hook Options
              </h3>
              <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs tabular-nums text-[var(--text-secondary)]">
                {hooks.length}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {hooks.map((hook, i) => {
                const isEdited = editedTexts[i] !== undefined && editedTexts[i] !== hook.hook_text;
                return (
                  <HookCard
                    key={i}
                    hook={hook}
                    index={i}
                    selected={selectedIndex === i}
                    edited={isEdited}
                    displayText={getDisplayText(i)}
                    onSelect={() => handleSelect(i)}
                  />
                );
              })}
            </div>
          </div>

          {/* Editable text field for selected hook */}
          {selectedHook && selectedIndex !== null && (
            <div ref={editorRef} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-secondary)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                    {selectedIndex + 1}
                  </span>
                  <span className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Edit Hook
                  </span>
                </div>
                {editedTexts[selectedIndex] !== undefined &&
                  editedTexts[selectedIndex] !== selectedHook.hook_text && (
                    <span className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)]">
                      Modified
                    </span>
                  )}
              </div>
              <textarea
                value={currentText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Edit your hook text…"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {selectedHook.target_networks.map((net) => (
                  <NetworkBadge key={net} name={net} />
                ))}
                {selectedHook.preserved_elements.length > 0 && (
                  <>
                    <span className="text-xs text-[var(--text-secondary)]">Preserves:</span>
                    {selectedHook.preserved_elements.map((el, i) => (
                      <span key={i} className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        {el}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Generate script button */}
          <div className="border-t border-[var(--border)] pt-6">
            <button
              onClick={() => onGenerateScript?.(currentText)}
              disabled={!hasSelection}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Generate Script
            </button>
            {!hasSelection && hooks.length > 0 && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Select a hook above to enable script generation
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
