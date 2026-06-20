"use client";

import type {
  ComparisonOutput,
  ComparisonNetworkDelta,
  ComparisonFixedIssue,
  ComparisonPersistentIssue,
} from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  Visual: "var(--score-excellent)",
  Auditory: "var(--score-good)",
  Attention: "var(--score-average)",
  Salience: "var(--score-below)",
  "Default Mode": "var(--accent)",
};

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
  icon,
}: {
  title: string;
  count?: number;
  icon?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-sm">{icon}</span>}
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

function DeltaCard({ item, type }: { item: ComparisonNetworkDelta; type: "improvement" | "regression" }) {
  const isUp = type === "improvement";
  const borderColor = isUp ? "var(--success)" : "var(--error)";
  return (
    <div
      className="rounded-xl border bg-[var(--bg-secondary)] p-4"
      style={{ borderColor: `color-mix(in srgb, ${borderColor} 30%, transparent)` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <NetworkTag network={item.network} />
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-[var(--text-secondary)]">
            {Math.round(item.v1_score)}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">&rarr;</span>
          <span className="text-xs font-medium tabular-nums text-[var(--text-primary)]">
            {Math.round(item.v2_score)}
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: isUp ? "var(--success)" : "var(--error)" }}
          >
            {isUp ? "+" : ""}{Math.round(item.delta)}
          </span>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {item.commentary}
      </p>
    </div>
  );
}

function FixedIssueCard({ item }: { item: ComparisonFixedIssue }) {
  return (
    <div className="rounded-xl border bg-[var(--bg-secondary)] p-4" style={{ borderColor: "color-mix(in srgb, var(--success) 30%, transparent)" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-mono tabular-nums text-[var(--success)]">
          {Math.floor(item.timestamp / 60)}:{Math.floor(item.timestamp % 60).toString().padStart(2, "0")}
        </span>
        <NetworkTag network={item.network} />
        <span className="rounded-md bg-[color-mix(in_srgb,var(--success)_15%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
          Fixed
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {item.description}
      </p>
    </div>
  );
}

function PersistentIssueCard({ item }: { item: ComparisonPersistentIssue }) {
  return (
    <div className="rounded-xl border bg-[var(--bg-secondary)] p-4" style={{ borderColor: "color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-mono tabular-nums text-[#f59e0b]">
          {Math.floor(item.timestamp / 60)}:{Math.floor(item.timestamp % 60).toString().padStart(2, "0")}
        </span>
        <NetworkTag network={item.network} />
        <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
          Persists
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {item.description}
      </p>
    </div>
  );
}

interface ComparisonDisplayProps {
  comparison: ComparisonOutput;
}

export default function ComparisonDisplay({ comparison }: ComparisonDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--bg-secondary)] p-6">
        <SectionHeader title="Version Comparison" icon="&#x1F504;" />
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]">
          {comparison.summary}
        </p>
      </div>

      {/* Improvements */}
      {comparison.improvements.length > 0 && (
        <div>
          <SectionHeader title="Improvements" count={comparison.improvements.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {comparison.improvements.map((item) => (
              <DeltaCard key={item.network} item={item} type="improvement" />
            ))}
          </div>
        </div>
      )}

      {/* Regressions */}
      {comparison.regressions.length > 0 && (
        <div>
          <SectionHeader title="Regressions" count={comparison.regressions.length} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {comparison.regressions.map((item) => (
              <DeltaCard key={item.network} item={item} type="regression" />
            ))}
          </div>
        </div>
      )}

      {/* Fixed Issues */}
      {comparison.fixed_issues.length > 0 && (
        <div>
          <SectionHeader title="Fixed Issues" count={comparison.fixed_issues.length} />
          <div className="mt-3 space-y-3">
            {comparison.fixed_issues.map((item, i) => (
              <FixedIssueCard key={`${item.network}-${item.timestamp}-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Persistent Issues */}
      {comparison.persistent_issues.length > 0 && (
        <div>
          <SectionHeader title="Persistent Issues" count={comparison.persistent_issues.length} />
          <div className="mt-3 space-y-3">
            {comparison.persistent_issues.map((item, i) => (
              <PersistentIssueCard key={`${item.network}-${item.timestamp}-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {comparison.recommendations.length > 0 && (
        <div>
          <SectionHeader title="Next Steps" count={comparison.recommendations.length} />
          <div className="mt-3 space-y-2">
            {comparison.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-medium text-[var(--accent)]">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
