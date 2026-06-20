"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TimelinePoint, SpikeEvent, DropOffEvent } from "@/lib/api";

const NETWORK_COLORS: Record<string, string> = {
  Visual: "#8b5cf6",
  Auditory: "#06b6d4",
  Attention: "#f59e0b",
  Salience: "#ef4444",
  "Default Mode": "#22c55e",
};

const NETWORK_ICONS: Record<string, string> = {
  Visual: "👁",
  Auditory: "👂",
  Attention: "🎯",
  Salience: "⚡",
  "Default Mode": "🧠",
};

interface V1DropOffOverlay {
  timestamp: number;
  duration: number;
  network: string;
  fixed: boolean;
}

interface TimelineChartProps {
  timeline: TimelinePoint[];
  spikes: SpikeEvent[];
  dropOffs: DropOffEvent[];
  v1DropOffs?: DropOffEvent[] | null;
  currentTime?: number;
}

interface ChartDataPoint {
  time: number;
  [network: string]: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 shadow-xl">
      <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
        {label}s
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-[var(--text-secondary)]">
            {NETWORK_ICONS[entry.dataKey] || ""} {entry.dataKey}
          </span>
          <span className="ml-auto pl-3 text-xs font-medium text-[var(--text-primary)]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-[var(--text-secondary)]">
            {NETWORK_ICONS[entry.value] || ""} {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function classifyV1DropOffs(
  v1Drops: DropOffEvent[],
  v2Drops: DropOffEvent[]
): V1DropOffOverlay[] {
  return v1Drops.map((v1) => {
    const persists = v2Drops.some(
      (v2) =>
        v2.network === v1.network &&
        v2.timestamp < v1.timestamp + v1.duration &&
        v2.timestamp + v2.duration > v1.timestamp
    );
    return {
      timestamp: v1.timestamp,
      duration: v1.duration,
      network: v1.network,
      fixed: !persists,
    };
  });
}

export default function TimelineChart({
  timeline,
  spikes,
  dropOffs,
  v1DropOffs,
  currentTime,
}: TimelineChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return timeline.map((point) => ({
      time: point.timestamp,
      ...point.scores,
    }));
  }, [timeline]);

  const networks = useMemo(() => {
    if (timeline.length === 0) return [];
    return Object.keys(timeline[0].scores);
  }, [timeline]);

  const v1Overlays = useMemo(() => {
    if (!v1DropOffs || v1DropOffs.length === 0) return [];
    return classifyV1DropOffs(v1DropOffs, dropOffs);
  }, [v1DropOffs, dropOffs]);

  if (timeline.length === 0) return null;

  const maxTime = timeline[timeline.length - 1].timestamp;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Network Activation Timeline
        </h3>
        {v1Overlays.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed" style={{ borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)" }} />
              <span className="text-xs text-[var(--text-secondary)]">Fixed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed" style={{ borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)" }} />
              <span className="text-xs text-[var(--text-secondary)]">Persists</span>
            </div>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, maxTime]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v: number) => `${Math.round(v)}s`}
            stroke="var(--border)"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            stroke="var(--border)"
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* v1 drop-off overlay zones (fixed = green, persists = amber) */}
          {v1Overlays.map((d, i) => (
            <ReferenceArea
              key={`v1-drop-${i}`}
              x1={d.timestamp}
              x2={d.timestamp + d.duration}
              y1={0}
              y2={100}
              fill={d.fixed ? "#22c55e" : "#f59e0b"}
              fillOpacity={0.1}
              stroke={d.fixed ? "#22c55e" : "#f59e0b"}
              strokeOpacity={0.35}
              strokeDasharray="6 3"
            />
          ))}

          {/* v2 drop-off zones */}
          {dropOffs.map((d, i) => (
            <ReferenceArea
              key={`drop-${i}`}
              x1={d.timestamp}
              x2={d.timestamp + d.duration}
              y1={0}
              y2={100}
              fill="#ef4444"
              fillOpacity={0.08}
              stroke="#ef4444"
              strokeOpacity={0.2}
              strokeDasharray="4 4"
            />
          ))}

          {/* Spike markers */}
          {spikes.map((s, i) => (
            <ReferenceLine
              key={`spike-${i}`}
              x={s.timestamp}
              stroke={NETWORK_COLORS[s.network] || "#8b5cf6"}
              strokeDasharray="2 4"
              strokeOpacity={0.5}
            />
          ))}

          {/* Playback position */}
          {currentTime != null && (
            <ReferenceLine
              x={currentTime}
              stroke="var(--accent)"
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          )}

          {/* Network lines */}
          {networks.map((net) => (
            <Line
              key={net}
              type="monotone"
              dataKey={net}
              stroke={NETWORK_COLORS[net] || "#888"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
