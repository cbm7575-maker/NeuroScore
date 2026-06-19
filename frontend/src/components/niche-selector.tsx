"use client";

import { useCallback, useEffect, useState } from "react";

export const NETWORKS = ["visual", "auditory", "language", "motion", "default_mode"] as const;
export type NetworkName = (typeof NETWORKS)[number];

export type NicheWeights = Record<NetworkName, number>;

export interface NichePreset {
  id: string;
  label: string;
  apiNiche: string;
  weights: NicheWeights;
}

export const NICHE_PRESETS: NichePreset[] = [
  {
    id: "general",
    label: "General",
    apiNiche: "general",
    weights: { visual: 20, auditory: 20, language: 20, motion: 20, default_mode: 20 },
  },
  {
    id: "comedy",
    label: "Comedy",
    apiNiche: "comedy",
    weights: { visual: 15, auditory: 20, language: 30, motion: 10, default_mode: 25 },
  },
  {
    id: "education",
    label: "Education",
    apiNiche: "education",
    weights: { visual: 20, auditory: 15, language: 30, motion: 5, default_mode: 30 },
  },
  {
    id: "fitness",
    label: "Fitness / Dance",
    apiNiche: "fitness",
    weights: { visual: 25, auditory: 20, language: 10, motion: 35, default_mode: 10 },
  },
];

const NETWORK_LABELS: Record<NetworkName, string> = {
  visual: "Visual",
  auditory: "Auditory",
  language: "Language",
  motion: "Motion",
  default_mode: "Default Mode",
};

function sumWeights(w: NicheWeights): number {
  return NETWORKS.reduce((sum, n) => sum + w[n], 0);
}

interface NicheSelectorProps {
  disabled?: boolean;
  onChange: (apiNiche: string, weights: NicheWeights) => void;
}

export default function NicheSelector({ disabled, onChange }: NicheSelectorProps) {
  const [activePreset, setActivePreset] = useState("general");
  const [customWeights, setCustomWeights] = useState<NicheWeights>({
    visual: 20, auditory: 20, language: 20, motion: 20, default_mode: 20,
  });

  const isCustom = activePreset === "custom";
  const currentWeights = isCustom
    ? customWeights
    : NICHE_PRESETS.find((p) => p.id === activePreset)!.weights;
  const total = sumWeights(currentWeights);
  const isValid = total === 100;

  const handlePresetClick = useCallback(
    (preset: NichePreset) => {
      setActivePreset(preset.id);
      onChange(preset.apiNiche, preset.weights);
    },
    [onChange]
  );

  const handleCustomClick = useCallback(() => {
    setActivePreset("custom");
  }, []);

  useEffect(() => {
    if (isCustom && isValid) {
      onChange("general", customWeights);
    }
  }, [isCustom, isValid, customWeights, onChange]);

  const handleSliderChange = useCallback(
    (network: NetworkName, value: number) => {
      setCustomWeights((prev) => ({ ...prev, [network]: value }));
    },
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm text-[var(--text-secondary)]">
          Content niche
        </label>
        <div className="flex flex-wrap gap-2">
          {NICHE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                activePreset === preset.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
              } disabled:opacity-50`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={handleCustomClick}
            disabled={disabled}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              isCustom
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
            } disabled:opacity-50`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Weight display */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Network Weights
          </span>
          <span
            className={`text-xs font-medium tabular-nums ${
              isValid ? "text-[var(--success)]" : "text-[var(--error)]"
            }`}
          >
            {total}%{!isValid && " (must equal 100%)"}
          </span>
        </div>

        <div className="space-y-3">
          {NETWORKS.map((network) => (
            <div key={network} className="flex items-center gap-3">
              <span className="w-24 text-xs text-[var(--text-secondary)]">
                {NETWORK_LABELS[network]}
              </span>
              {isCustom ? (
                <>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={customWeights[network]}
                    onChange={(e) =>
                      handleSliderChange(network, Number(e.target.value))
                    }
                    disabled={disabled}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--bg-tertiary)] accent-[var(--accent)]"
                  />
                  <span className="w-10 text-right text-xs font-medium tabular-nums text-[var(--text-primary)]">
                    {customWeights[network]}%
                  </span>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${currentWeights[network]}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs font-medium tabular-nums text-[var(--text-primary)]">
                    {currentWeights[network]}%
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
