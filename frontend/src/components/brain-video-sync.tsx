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
}

const BrainVideoSync = forwardRef<BrainVideoSyncHandle, BrainVideoSyncProps>(
  function BrainVideoSync({ videoId, timeline, spikes, dropOffs }, ref) {
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
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 3D Brain Visualization */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Neural Activation Map
            </h3>
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
          currentTime={currentTime}
        />
      </div>
    );
  }
);

export default BrainVideoSync;
