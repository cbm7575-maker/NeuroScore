"use client";

import type {
  AnalysisOutput,
  DropOffDetail,
  NetworkInterpretation,
  Suggestion,
  StrengthHighlight,
} from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  Visual: "var(--score-excellent)",
  Auditory: "var(--score-good)",
  Attention: "var(--score-average)",
  Salience: "var(--score-below)",
  "Default Mode": "var(--accent)",
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TimestampBadge({
  timestamp,
  onClick,
}: {
  timestamp: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-mono tabular-nums text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15"
    >
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z" />
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
      </svg>
      {formatTimestamp(timestamp)}
    </button>
  );
}

function NetworkTag({ network }: { network: string }) {
  const color = NETWORK_COLORS[network] ?? "var(--text-secondary)";
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
      }}
    >
      {network}
    </span>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        {title}
      </h3>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs tabular-nums text-[var(--text-secondary)]">
          {count}
        </span>
      )}
    </div>
  );
}

function OverallAssessment({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
      <SectionHeader title="Overall Assessment" />
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]">
        {text}
      </p>
    </div>
  );
}

function InterpretationCard({ item }: { item: NetworkInterpretation }) {
  const color = NETWORK_COLORS[item.network] ?? "var(--text-secondary)";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <NetworkTag network={item.network} />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-secondary)]">
            {item.label}
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color }}
          >
            {Math.round(item.score)}
          </span>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {item.interpretation}
      </p>
    </div>
  );
}

function DropOffCard({
  item,
  onTimestampClick,
}: {
  item: DropOffDetail;
  onTimestampClick?: (t: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TimestampBadge
          timestamp={item.timestamp}
          onClick={() => onTimestampClick?.(item.timestamp)}
        />
        <NetworkTag network={item.network} />
        <span className="text-xs text-[var(--text-secondary)]">
          {item.duration}s duration
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {item.description}
      </p>
    </div>
  );
}

function SuggestionCard({
  item,
  onTimestampClick,
}: {
  item: Suggestion;
  onTimestampClick?: (t: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {item.timestamp !== null && (
          <TimestampBadge
            timestamp={item.timestamp}
            onClick={() => onTimestampClick?.(item.timestamp!)}
          />
        )}
        {item.network && <NetworkTag network={item.network} />}
        {item.timestamp === null && !item.network && (
          <span className="inline-flex items-center rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
            General
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">
        {item.suggestion}
      </p>
    </div>
  );
}

function StrengthCard({
  item,
  onTimestampClick,
}: {
  item: StrengthHighlight;
  onTimestampClick?: (t: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {item.timestamp !== null && (
          <TimestampBadge
            timestamp={item.timestamp}
            onClick={() => onTimestampClick?.(item.timestamp!)}
          />
        )}
        {item.network && <NetworkTag network={item.network} />}
        {item.timestamp === null && !item.network && (
          <span className="inline-flex items-center rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
            General
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">
        {item.description}
      </p>
    </div>
  );
}

interface AnalysisDisplayProps {
  analysis: AnalysisOutput;
  onTimestampClick?: (timestamp: number) => void;
}

export default function AnalysisDisplay({
  analysis,
  onTimestampClick,
}: AnalysisDisplayProps) {
  return (
    <div className="space-y-6">
      <OverallAssessment text={analysis.overall_assessment} />

      {analysis.network_interpretations.length > 0 && (
        <div>
          <SectionHeader
            title="Network Interpretations"
            count={analysis.network_interpretations.length}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.network_interpretations.map((item) => (
              <InterpretationCard key={item.network} item={item} />
            ))}
          </div>
        </div>
      )}

      {analysis.drop_off_analysis.length > 0 && (
        <div>
          <SectionHeader
            title="Drop-Off Analysis"
            count={analysis.drop_off_analysis.length}
          />
          <div className="mt-3 space-y-3">
            {analysis.drop_off_analysis.map((item, i) => (
              <DropOffCard
                key={`${item.network}-${item.timestamp}-${i}`}
                item={item}
                onTimestampClick={onTimestampClick}
              />
            ))}
          </div>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div>
          <SectionHeader
            title="Improvement Suggestions"
            count={analysis.suggestions.length}
          />
          <div className="mt-3 space-y-3">
            {analysis.suggestions.map((item, i) => (
              <SuggestionCard
                key={`${item.network}-${item.timestamp}-${i}`}
                item={item}
                onTimestampClick={onTimestampClick}
              />
            ))}
          </div>
        </div>
      )}

      {analysis.strength_highlights.length > 0 && (
        <div>
          <SectionHeader
            title="Strength Highlights"
            count={analysis.strength_highlights.length}
          />
          <div className="mt-3 space-y-3">
            {analysis.strength_highlights.map((item, i) => (
              <StrengthCard
                key={`${item.network}-${item.timestamp}-${i}`}
                item={item}
                onTimestampClick={onTimestampClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
