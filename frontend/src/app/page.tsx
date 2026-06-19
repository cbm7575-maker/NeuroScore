"use client";

import { useState } from "react";
import VideoUpload from "@/components/video-upload";
import ScoreDisplay from "@/components/score-display";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Upload your video
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Upload a video to analyze its predicted neural engagement
        </p>
      </div>
      <VideoUpload onUploadComplete={(id) => setVideoId(id)} />
      {videoId && (
        <div>
          <div className="mb-6 border-t border-[var(--border)]" />
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">
            Neural Engagement Scores
          </h2>
          <ScoreDisplay videoId={videoId} />
        </div>
      )}
    </div>
  );
}
