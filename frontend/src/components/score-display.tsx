"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  runAnalysis,
  runInference,
  pollInferenceUntilComplete,
  type AnalysisResponse,
  type NetworkScore,
} from "@/lib/api";
import CompositeScore from "./composite-score";
import NetworkScoreCard from "./network-score-card";
import AnalysisDisplay from "./analysis-display";
import NicheSelector, { type NicheWeights } from "./niche-selector";
import BrainVideoSync, { type BrainVideoSyncHandle } from "./brain-video-sync";

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

type PipelineStage = "inference" | "analysis" | null;

interface ScoreDisplayProps {
  videoId: string;
  autoAnalyze?: boolean;
  onGenerateHooks?: () => void;
  onReupload?: () => void;
  onAnalysisComplete?: (result: AnalysisResponse) => void;
  onNicheChange?: (niche: string) => void;
}

export default function ScoreDisplay({
  videoId,
  autoAnalyze = false,
  onGenerateHooks,
  onReupload,
  onAnalysisComplete,
  onNicheChange,
}: ScoreDisplayProps) {
  const [currentNiche, setCurrentNiche] = useState("general");
  const [currentWeights, setCurrentWeights] = useState<NicheWeights>({
    visual: 20, auditory: 20, language: 20, motion: 20, default_mode: 20,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(null);
  const syncRef = useRef<BrainVideoSyncHandle>(null);
  const autoAnalyzedRef = useRef(false);

  const handleTimestampClick = useCallback((time: number) => {
    syncRef.current?.seekTo(time);
  }, []);

  const analyze = useCallback(
    async (niche: string) => {
      setError(null);
      setLoading(true);
      try {
        setPipelineStage("inference");
        const job = await runInference(videoId);
        if (job.status !== "completed") {
          await pollInferenceUntilComplete(videoId);
        }

        setPipelineStage("analysis");
        const res = await runAnalysis(videoId, niche);
        setResult(res);
        onAnalysisComplete?.(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setLoading(false);
        setPipelineStage(null);
      }
    },
    [videoId, onAnalysisComplete]
  );

  useEffect(() => {
    if (autoAnalyze && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      analyze(currentNiche);
    }
  }, [autoAnalyze, analyze, currentNiche]);

  const handleNicheChange = useCallback(
    (apiNiche: string, weights: NicheWeights) => {
      setCurrentNiche(apiNiche);
      setCurrentWeights(weights);
      sessionStorage.setItem("neuroscore_niche", apiNiche);
      onNicheChange?.(apiNiche);
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
            {pipelineStage === "inference"
              ? "Running neural inference (TRIBE v2)..."
              : "Running neural engagement analysis..."}
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

          {/* 3D Brain + Video Player + Timeline */}
          {result.timeline && result.timeline.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Brain Visualization
              </h3>
              <BrainVideoSync
                ref={syncRef}
                videoId={videoId}
                timeline={result.timeline}
                spikes={result.spikes || []}
                dropOffs={result.drop_offs || []}
              />
            </div>
          )}

          {/* LLM Analysis */}
          <div className="border-t border-[var(--border)] pt-6">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">
              Analysis Results
            </h2>
            <AnalysisDisplay
              analysis={result.analysis}
              onTimestampClick={handleTimestampClick}
            />
          </div>

          {/* Funnel actions */}
          <div className="border-t border-[var(--border)] pt-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onGenerateHooks}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate Hooks
              </button>
              <button
                onClick={onReupload}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                </svg>
                Re-upload Improved Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
