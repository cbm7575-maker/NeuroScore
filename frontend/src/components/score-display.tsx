"use client";

import { useCallback, useState } from "react";
import { runAnalysis, type AnalysisResponse, type NetworkScore } from "@/lib/api";
import CompositeScore from "./composite-score";
import NetworkScoreCard from "./network-score-card";

const NICHE_OPTIONS = [
  "general",
  "tech",
  "fitness",
  "finance",
  "education",
  "entertainment",
  "gaming",
  "beauty",
  "food",
  "travel",
  "news",
  "music",
  "comedy",
  "lifestyle",
  "sports",
];

function computeComposite(scores: NetworkScore[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return total / scores.length;
}

interface ScoreDisplayProps {
  videoId: string;
}

export default function ScoreDisplay({ videoId }: ScoreDisplayProps) {
  const [niche, setNiche] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const analyze = useCallback(
    async (selectedNiche: string) => {
      setError(null);
      setLoading(true);
      try {
        const res = await runAnalysis(videoId, selectedNiche);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setLoading(false);
      }
    },
    [videoId]
  );

  const handleNicheChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      setNiche(next);
      analyze(next);
    },
    [analyze]
  );

  const composite = result ? computeComposite(result.network_scores) : 0;

  return (
    <div className="space-y-6">
      {/* Niche selector + analyze button */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label
            htmlFor="niche-select"
            className="mb-1.5 block text-sm text-[var(--text-secondary)]"
          >
            Content niche
          </label>
          <select
            id="niche-select"
            value={niche}
            onChange={handleNicheChange}
            disabled={loading}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
          >
            {NICHE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.charAt(0).toUpperCase() + n.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {!result && (
          <button
            onClick={() => analyze(niche)}
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Video"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && !result && (
        <div className="flex flex-col items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--bg-tertiary)] border-t-[var(--accent)]" />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            Running neural engagement analysis...
          </p>
        </div>
      )}

      {/* Scores */}
      {result && (
        <div className="space-y-6">
          {/* Composite score */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8">
            <h3 className="mb-6 text-center text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Overall Neural Engagement
            </h3>
            <CompositeScore
              score={composite}
              label={result.analysis.overall_assessment.slice(0, 80)}
            />
          </div>

          {/* Network scores grid */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Network Scores
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.network_scores.map((ns) => (
                <NetworkScoreCard
                  key={ns.name}
                  name={ns.name}
                  score={ns.score}
                  label={ns.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
