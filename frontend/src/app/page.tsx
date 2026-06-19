"use client";

import { useState } from "react";
import VideoUpload from "@/components/video-upload";
import ScoreDisplay from "@/components/score-display";
import TabNavigation, { type TabId } from "@/components/tab-navigation";
import HooksTab from "@/components/hooks-tab";
import type { AnalysisResponse } from "@/lib/api";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null
  );
  const [showReupload, setShowReupload] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);

  const handleGenerateHooks = () => {
    setActiveTab("hooks");
  };

  const handleGenerateScript = (hookText: string) => {
    setSelectedHook(hookText);
    setActiveTab("script");
  };

  const handleReupload = () => {
    setShowReupload(true);
  };

  const handleReuploadComplete = (newVideoId: string) => {
    setVideoId(newVideoId);
    setShowReupload(false);
    setAnalysisResult(null);
    setSelectedHook(null);
  };

  const handleCancelReupload = () => {
    setShowReupload(false);
  };

  return (
    <div className="space-y-6">
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hooksEnabled={analysisResult !== null}
        scriptEnabled={selectedHook !== null}
      />

      {activeTab === "analysis" && (
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
              <ScoreDisplay
                videoId={videoId}
                onGenerateHooks={handleGenerateHooks}
                onReupload={handleReupload}
                onAnalysisComplete={setAnalysisResult}
              />
            </div>
          )}

          {showReupload && (
            <div className="space-y-4">
              <div className="border-t border-[var(--border)] pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      Re-upload Improved Version
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Upload an improved version of your video to compare neural
                      engagement scores
                    </p>
                  </div>
                  <button
                    onClick={handleCancelReupload}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <VideoUpload onUploadComplete={handleReuploadComplete} />
            </div>
          )}
        </div>
      )}

      {activeTab === "hooks" && analysisResult && videoId && (
        <HooksTab
          videoId={videoId}
          analysisResult={analysisResult}
          onGenerateScript={handleGenerateScript}
        />
      )}

      {activeTab === "script" && selectedHook && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Generate Script
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Generating a full script from your selected hook
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Selected Hook
            </h3>
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
              {selectedHook}
            </p>
          </div>
          <div className="flex flex-col items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--bg-tertiary)] border-t-[var(--accent)]" />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Generating script...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
