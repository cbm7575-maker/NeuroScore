"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface VideoPlayerProps {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  onSeek: (time: number) => void;
  onDurationChange: (duration: number) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      videoUrl,
      currentTime,
      isPlaying,
      onTimeUpdate,
      onPlayPause,
      onSeek,
      onDurationChange,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const seekingRef = useRef(false);
    const [duration, setDuration] = useState(0);

    useImperativeHandle(ref, () => ({
      seekTo(time: number) {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          onSeek(time);
        }
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (isPlaying) video.play().catch(() => {});
      else video.pause();
    }, [isPlaying]);

    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current && !seekingRef.current) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    }, [onTimeUpdate]);

    const handleSeekInput = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        seekingRef.current = true;
        if (videoRef.current) videoRef.current.currentTime = time;
        onSeek(time);
        requestAnimationFrame(() => {
          seekingRef.current = false;
        });
      },
      [onSeek]
    );

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        const d = videoRef.current.duration;
        setDuration(d);
        onDurationChange(d);
      }
    }, [onDurationChange]);

    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video bg-black"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => onPlayPause(false)}
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          preload="metadata"
        />
        <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={() => onPlayPause(!isPlaying)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent-hover)]"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg
                width="12"
                height="14"
                viewBox="0 0 12 14"
                fill="currentColor"
              >
                <rect x="1" y="1" width="3" height="12" rx="1" />
                <rect x="8" y="1" width="3" height="12" rx="1" />
              </svg>
            ) : (
              <svg
                width="12"
                height="14"
                viewBox="0 0 12 14"
                fill="currentColor"
              >
                <path d="M2 1v12l9-6z" />
              </svg>
            )}
          </button>
          <span className="min-w-[36px] text-xs tabular-nums text-[var(--text-secondary)]">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeekInput}
            className="video-seek flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-[var(--bg-tertiary)]"
          />
          <span className="min-w-[36px] text-right text-xs tabular-nums text-[var(--text-secondary)]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  }
);

export default VideoPlayer;
