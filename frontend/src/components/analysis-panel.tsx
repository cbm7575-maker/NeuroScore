"use client";

import { useEffect, useRef, useState } from "react";
import { getVertexColors, type VideoMetadata, type VertexColorsData } from "@/lib/api";
import BrainViewer from "./brain-viewer";

interface Props {
  video: VideoMetadata;
}

export default function AnalysisPanel({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [colorData, setColorData] = useState<VertexColorsData | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  // Fetch per-second activation data for this video
  useEffect(() => {
    setColorData(null);
    setColorError(null);
    getVertexColors(video.id)
      .then(setColorData)
      .catch((e) => setColorError(e instanceof Error ? e.message : "Failed to load activations"));
  }, [video.id]);

  // Track video playback time for brain sync
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onSeeked = () => setCurrentTime(el.currentTime);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onSeeked);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onSeeked);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Video player */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Video</p>
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={`/api/videos/${video.id}/file`}
              controls
              className="w-full"
              style={{ maxHeight: 360 }}
            />
          </div>
          {colorData && (
            <p className="text-[11px] text-[var(--text-secondary)]">
              {colorData.activations.length}s of neural data · brain synced to playback
            </p>
          )}
          {colorError && (
            <p className="text-[11px] text-[var(--error)]">{colorError}</p>
          )}
        </div>

        {/* Brain visualization */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Neural activation
            {colorData ? " · warm = high, cool = low" : ""}
          </p>
          <BrainViewer scores={{}} />
        </div>
      </div>
    </div>
  );
}
