"use client";

interface CompositeScoreProps {
  score: number;
  label: string;
}

function getScoreColor(score: number): string {
  if (score >= 86) return "var(--score-excellent)";
  if (score >= 71) return "var(--score-good)";
  if (score >= 51) return "var(--score-average)";
  if (score >= 31) return "var(--score-below)";
  return "var(--score-poor)";
}

function getScoreLabel(score: number): string {
  if (score >= 86) return "Excellent";
  if (score >= 71) return "Good";
  if (score >= 51) return "Average";
  if (score >= 31) return "Below Average";
  return "Poor";
}

export default function CompositeScore({ score, label }: CompositeScoreProps) {
  const color = getScoreColor(score);
  const qualityLabel = getScoreLabel(score);
  const rounded = Math.round(score);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[200px] w-[200px]">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            {rounded}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color }}>
          {qualityLabel}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  );
}
