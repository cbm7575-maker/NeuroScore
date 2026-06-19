"use client";

interface NetworkScoreCardProps {
  name: string;
  score: number;
  label: string;
}

const NETWORK_ICONS: Record<string, string> = {
  visual: "👁",
  auditory: "👂",
  language: "💬",
  motion: "🏃",
  default_mode: "🧠",
};

const NETWORK_DISPLAY_NAMES: Record<string, string> = {
  visual: "Visual",
  auditory: "Auditory",
  language: "Language",
  motion: "Motion",
  default_mode: "Default Mode",
};

function getScoreColor(score: number): string {
  if (score >= 86) return "var(--score-excellent)";
  if (score >= 71) return "var(--score-good)";
  if (score >= 51) return "var(--score-average)";
  if (score >= 31) return "var(--score-below)";
  return "var(--score-poor)";
}

function getMultiplier(score: number): string {
  const mult = score / 50;
  return `${mult.toFixed(1)}x`;
}

export default function NetworkScoreCard({
  name,
  score,
  label,
}: NetworkScoreCardProps) {
  const color = getScoreColor(score);
  const icon = NETWORK_ICONS[name] ?? "🔬";
  const displayName = NETWORK_DISPLAY_NAMES[name] ?? name;
  const multiplier = getMultiplier(score);
  const rounded = Math.round(score);
  const widthPercent = Math.min(Math.max(score, 0), 100);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {multiplier}
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color }}
          >
            {rounded}
          </span>
        </div>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
