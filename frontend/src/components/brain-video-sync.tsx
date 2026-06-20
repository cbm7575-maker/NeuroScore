"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import VideoPlayer, { type VideoPlayerHandle } from "./video-player";
import TimelineChart from "./timeline-chart";
import type { TimelinePoint, SpikeEvent, DropOffEvent } from "@/lib/api";

const BrainViewer = dynamic(() => import("./brain-viewer"), { ssr: false });

const NETWORK_HEX: Record<string, string> = {
  Visual: "#8b5cf6",
  Auditory: "#06b6d4",
  Attention: "#f59e0b",
  Salience: "#ef4444",
  "Default Mode": "#22c55e",
};

export interface BrainVideoSyncHandle {
  seekTo: (time: number) => void;
}

interface BrainVideoSyncProps {
  videoId: string;
  timeline: TimelinePoint[];
  spikes: SpikeEvent[];
  dropOffs: DropOffEvent[];
  v1DropOffs?: DropOffEvent[] | null;
  v1Timeline?: TimelinePoint[] | null;
}

const BrainVideoSync = forwardRef<BrainVideoSyncHandle, BrainVideoSyncProps>(
  function BrainVideoSync({ videoId, timeline, spikes, dropOffs, v1DropOffs, v1Timeline }, ref) {
    const playerRef = useRef<VideoPlayerHandle>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo(time: number) {
        playerRef.current?.seekTo(time);
      },
    }));

    const videoUrl = `/api/videos/${videoId}/file`;

    const currentScores = useMemo(() => {
      if (timeline.length === 0) return {};
      const idx = Math.min(
        Math.max(0, Math.floor(currentTime)),
        timeline.length - 1
      );
      return timeline[idx].scores;
    }, [currentTime, timeline]);

    const v1CurrentScores = useMemo(() => {
      if (!v1Timeline || v1Timeline.length === 0) return null;
      const idx = Math.min(
        Math.max(0, Math.floor(currentTime)),
        v1Timeline.length - 1
      );
      return v1Timeline[idx].scores;
    }, [currentTime, v1Timeline]);

    const hasV1 = v1CurrentScores !== null;

    const handleTimeUpdate = useCallback((time: number) => {
      setCurrentTime(time);
    }, []);

    const handlePlayPause = useCallback((playing: boolean) => {
      setIsPlaying(playing);
    }, []);

    const handleSeek = useCallback((time: number) => {
      setCurrentTime(time);
    }, []);

    const handleDurationChange = useCallback(() => {}, []);

    return (
      <div className="space-y-4">
        <div className={`grid gap-4 ${hasV1 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {/* V1 Brain (only when comparison data exists) */}
          {hasV1 && v1CurrentScores && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  Original (v1)
                </h3>
                <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  v1
                </span>
              </div>
              <div className="aspect-square">
                <BrainViewer scores={v1CurrentScores} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {Object.entries(v1CurrentScores).map(([name, score]) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: NETWORK_HEX[name] || "#888",
                        opacity: 0.3 + (score / 100) * 0.7,
                      }}
                    />
                    <span className="truncate text-xs text-[var(--text-secondary)]">
                      {name}
                    </span>
                    <span className="ml-auto text-xs font-medium tabular-nums text-[var(--text-primary)]">
                      {Math.round(score)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* V2 / Current Brain Visualization */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                {hasV1 ? "Re-upload (v2)" : "Neural Activation Map"}
              </h3>
              {hasV1 && (
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                  v2
                </span>
              )}
            </div>
            <div className="aspect-square">
              <BrainViewer scores={currentScores} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {Object.entries(currentScores).map(([name, score]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: NETWORK_HEX[name] || "#888",
                      opacity: 0.3 + (score / 100) * 0.7,
                    }}
                  />
                  <span className="truncate text-xs text-[var(--text-secondary)]">
                    {name}
                  </span>
                  <span className="ml-auto text-xs font-medium tabular-nums text-[var(--text-primary)]">
                    {Math.round(score)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Video Player */}
          <div className="flex flex-col">
            <VideoPlayer
              ref={playerRef}
              videoUrl={videoUrl}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onTimeUpdate={handleTimeUpdate}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onDurationChange={handleDurationChange}
            />
            <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">
              Play the video to see brain activation update in real time
            </p>
          </div>
        </div>

        {/* Timeline Chart synced with playback */}
        <TimelineChart
          timeline={timeline}
          spikes={spikes}
          dropOffs={dropOffs}
          v1DropOffs={v1DropOffs}
          currentTime={currentTime}
        />
      </div>
    );
  }
);

export default BrainVideoSync;
