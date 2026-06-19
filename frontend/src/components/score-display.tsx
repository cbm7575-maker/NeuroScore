"use client";

import { useCallback, useState } from "react";
import { runAnalysis, type AnalysisResponse, type NetworkScore } from "@/lib/api";
import CompositeScore from "./composite-score";
import NetworkScoreCard from "./network-score-card";
import TimelineChart from "./timeline-chart";
import AnalysisDisplay from "./analysis-display";
import NicheSelector, { type NicheWeights } from "./niche-selector";

function computeWeightedComposite(
  scores: NetworkScore[],
  weights: NicheWeights
): number {
  if (scores.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const key = s.name as keyof NicheWeights;
    const w = weights[key] ?? 0;
    weighted += s.score * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

interface ScoreDisplayProps {
  videoId: string;
}

export default function ScoreDisplay({ videoId }: ScoreDisplayProps) {
  const [currentNiche, setCurrentNiche] = useState("general");
  const [currentWeights, setCurrentWeights] = useState<NicheWeights>({
    visual: 20, auditory: 20, language: 20, motion: 20, default_mode: 20,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const analyze = useCallback(
    async (niche: string) => {
      setError(null);
      setLoading(true);
      try {
        const res = await runAnalysis(videoId, niche);
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
    (apiNiche: string, weights: NicheWeights) => {
      setCurrentNiche(apiNiche);
      setCurrentWeights(weights);
      if (result) {
        analyze(apiNiche);
      }
    },
    [analyze, result]
  );

  const composite = result
    ? computeWeightedComposite(result.network_scores, currentWeights)
    : 0;

  return (
    <div className="space-y-6">
      {/* Niche selector */}
      <NicheSelector disabled={loading} onChange={handleNicheChange} />

      {/* Analyze button */}
      {!result && (
        <button
          onClick={() => analyze(currentNiche)}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze Video"}
        </button>
      )}

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

          {/* Timeline chart */}
          {result.timeline && result.timeline.length > 0 && (
            <TimelineChart
              timeline={result.timeline}
              spikes={result.spikes || []}
              dropOffs={result.drop_offs || []}
            />
          )}

          {/* LLM Analysis */}
          <div className="border-t border-[var(--border)] pt-6">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Analysis Results
            </h2>
            <AnalysisDisplay analysis={result.analysis} />
          </div>
        </div>
      )}
    </div>
  );
}
