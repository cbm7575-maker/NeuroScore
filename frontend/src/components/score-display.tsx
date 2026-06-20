"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAnalysis,
  getVideoMetadata,
  runAnalysis,
  runComparison,
  runInference,
  pollInferenceUntilComplete,
  type AnalysisResponse,
  type ComparisonOutput,
  type DropOffEvent,
  type NetworkScore,
  type TimelinePoint,
} from "@/lib/api";
import CompositeScore from "./composite-score";
import NetworkScoreCard from "./network-score-card";
import AnalysisDisplay from "./analysis-display";
import ComparisonDisplay from "./comparison-display";
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
  const [v1Scores, setV1Scores] = useState<NetworkScore[] | null>(null);
  const [v1DropOffs, setV1DropOffs] = useState<DropOffEvent[] | null>(null);
  const [v1Timeline, setV1Timeline] = useState<TimelinePoint[] | null>(null);
  const [comparison, setComparison] = useState<ComparisonOutput | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [videoVersion, setVideoVersion] = useState<number>(1);
  const [originalVideoId, setOriginalVideoId] = useState<string | null>(null);
  const syncRef = useRef<BrainVideoSyncHandle>(null);
  const autoAnalyzedRef = useRef(false);

  const isReupload = videoVersion >= 2;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getVideoMetadata(videoId);
        if (!cancelled) {
          setVideoVersion(meta.version);
          setOriginalVideoId(meta.original_video_id);
        }
      } catch {
        // metadata may not be available yet
      }
    })();
    return () => { cancelled = true; };
  }, [videoId]);

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

  useEffect(() => {
    if (!result || !originalVideoId) return;
    let cancelled = false;
    (async () => {
      let hasV1Analysis = false;
      try {
        const v1Analysis = await getAnalysis(originalVideoId);
        if (!cancelled) {
          setV1Scores(v1Analysis.network_scores);
          setV1DropOffs(v1Analysis.drop_offs || []);
          setV1Timeline(v1Analysis.timeline || []);
          hasV1Analysis = true;
        }
      } catch {
        // v1 analysis may not exist yet (first re-upload)
      }

      if (hasV1Analysis && !cancelled) {
        setComparisonLoading(true);
        try {
          const compRes = await runComparison(videoId);
          if (!cancelled) setComparison(compRes.comparison);
        } catch {
          // comparison generation may fail
        } finally {
          if (!cancelled) setComparisonLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [result, videoId, originalVideoId]);

  const composite = result
    ? computeWeightedComposite(result.network_scores, currentWeights)
    : 0;

  const compositeDelta = useMemo(() => {
    if (!result || !v1Scores) return null;
    const v1Composite = computeWeightedComposite(v1Scores, currentWeights);
    return composite - v1Composite;
  }, [composite, v1Scores, currentWeights, result]);

  const networkDeltas = useMemo(() => {
    if (!result || !v1Scores) return null;
    const map: Record<string, number> = {};
    for (const v2 of result.network_scores) {
      const v1 = v1Scores.find((s) => s.name === v2.name);
      if (v1) map[v2.name] = v2.score - v1.score;
    }
    return map;
  }, [result, v1Scores]);

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
              ? isReupload
                ? "Running neural inference on improved version..."
                : "Running neural inference (TRIBE v2)..."
              : isReupload
                ? "Analyzing improved version..."
                : "Running neural engagement analysis..."}
          </p>
          {isReupload && (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Comparison with original will appear once complete
            </p>
          )}
        </div>
      )}

      {/* Scores */}
      {result && (
        <div className="space-y-6">
          {/* Version banner for re-uploads */}
          {isReupload && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3">
              <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                v{videoVersion}
              </span>
              <p className="text-sm text-[var(--text-secondary)]">
                Improved version &mdash; scores and comparisons are relative to the original
              </p>
            </div>
          )}

          {/* Composite score */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8">
            <div className="mb-6 flex items-center justify-center gap-2">
              <h3 className="text-center text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Overall Neural Engagement
              </h3>
              {isReupload && (
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                  v{videoVersion}
                </span>
              )}
            </div>
            <CompositeScore
              score={composite}
              label={result.analysis.overall_assessment.slice(0, 80)}
              delta={compositeDelta}
            />
          </div>

          {/* Network scores grid */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Network Scores
              </h3>
              {isReupload && (
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                  v{videoVersion}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.network_scores.map((ns) => (
                <NetworkScoreCard
                  key={ns.name}
                  name={ns.name}
                  score={ns.score}
                  label={ns.label}
                  delta={networkDeltas?.[ns.name]}
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
                v1DropOffs={v1DropOffs}
                v1Timeline={v1Timeline}
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

          {/* First re-upload notice (v1 not analyzed yet) */}
          {isReupload && !v1Scores && !comparisonLoading && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">&#x2139;&#xFE0F;</span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    No original analysis available
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    The original video hasn&apos;t been analyzed yet. Score deltas, brain comparisons, and LLM commentary will appear once the original is also analyzed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Commentary */}
          {(comparison || comparisonLoading) && (
            <div className="border-t border-[var(--border)] pt-6">
              <h2 className="mb-4 text-2xl font-semibold tracking-tight">
                Version Comparison
              </h2>
              {comparisonLoading ? (
                <div className="flex flex-col items-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--bg-tertiary)] border-t-[var(--accent)]" />
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    Generating comparison commentary...
                  </p>
                </div>
              ) : (
                comparison && <ComparisonDisplay comparison={comparison} />
              )}
            </div>
          )}

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
