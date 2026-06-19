"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCompositeScore,
  type CompositeScoreResponse,
  type NichePreset,
  type NicheWeights,
} from "@/lib/api";
import BrainViewer from "./brain-viewer";

const PRESET_LABELS: Record<NichePreset, string> = {
  default: "Default",
  comedy: "Comedy",
  education: "Education",
  fitness: "Fitness / Dance",
  custom: "Custom",
};

const PRESET_DESCRIPTIONS: Record<NichePreset, string> = {
  default: "Equal weights across all networks",
  comedy: "Auditory & language-heavy",
  education: "Language & default mode focus",
  fitness: "Motion & visual dominant",
  custom: "Define your own weights",
};

const DEFAULT_CUSTOM_WEIGHTS: NicheWeights = {
  auditory: 0.2,
  language: 0.2,
  visual: 0.2,
  default_mode: 0.2,
  motion: 0.2,
};

const NETWORK_LABELS: Record<keyof NicheWeights, string> = {
  auditory: "Auditory",
  language: "Language",
  visual: "Visual",
  default_mode: "Default Mode",
  motion: "Motion",
};

const PRESETS: NichePreset[] = ["default", "comedy", "education", "fitness", "custom"];

function weightSum(w: NicheWeights): number {
  return Object.values(w).reduce((a, b) => a + b, 0);
}

interface Props {
  videoId: string;
}

export default function NicheSelector({ videoId }: Props) {
  const [preset, setPreset] = useState<NichePreset>("default");
  const [customWeights, setCustomWeights] = useState<NicheWeights>(DEFAULT_CUSTOM_WEIGHTS);
  const [result, setResult] = useState<CompositeScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchScore = useCallback(
    async (p: NichePreset, cw: NicheWeights) => {
      if (p === "custom" && Math.abs(weightSum(cw) - 1.0) > 0.001) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getCompositeScore(videoId, p, p === "custom" ? cw : undefined);
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Score calculation failed");
      } finally {
        setLoading(false);
      }
    },
    [videoId]
  );

  useEffect(() => {
    if (preset !== "custom") {
      fetchScore(preset, customWeights);
    }
  }, [preset]);

  const handleCustomWeightChange = (key: keyof NicheWeights, pct: number) => {
    const next = { ...customWeights, [key]: pct / 100 };
    setCustomWeights(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchScore("custom", next), 400);
  };

  const customSum = Math.round(weightSum(customWeights) * 100);
  const customValid = customSum === 100;

  const activeWeights = result?.weights_used;
  const networkScores = result?.network_scores;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">Content Niche</h3>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Select a preset to weight network scores for your content type
        </p>
      </div>

      {/* Preset tabs */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`
              rounded-lg px-3 py-1.5 text-sm font-medium transition-all
              ${
                preset === p
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }
            `}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--text-secondary)]">{PRESET_DESCRIPTIONS[preset]}</p>

      {/* Custom weight sliders */}
      {preset === "custom" && (
        <div className="space-y-3">
          {(Object.keys(NETWORK_LABELS) as (keyof NicheWeights)[]).map((key) => {
            const pct = Math.round(customWeights[key] * 100);
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{NETWORK_LABELS[key]}</span>
                  <span className={customValid ? "text-[var(--text-primary)]" : "text-[var(--error)]"}>
                    {pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) => handleCustomWeightChange(key, parseInt(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            );
          })}
          <p className={`text-xs ${customValid ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            Total: {customSum}% {customValid ? "(valid)" : "(must equal 100%)"}
          </p>
        </div>
      )}

      {/* Score display */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          Calculating...
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Composite score */}
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold tracking-tight">
              {result.composite_score.toFixed(1)}
            </span>
            <span className="mb-1 text-sm text-[var(--text-secondary)]">/ 100 composite</span>
          </div>

          {/* Network score bars */}
          <div className="space-y-2">
            {(Object.keys(NETWORK_LABELS) as (keyof NicheWeights)[]).map((key) => {
              const score = networkScores![key];
              const weight = activeWeights![key];
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{NETWORK_LABELS[key]}</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      {score.toFixed(1)} × {Math.round(weight * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] opacity-70 transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3D brain activity map */}
          <div className="pt-2">
            <BrainViewer networkScores={result.network_scores} />
          </div>
        </div>
      )}
    </div>
  );
}
