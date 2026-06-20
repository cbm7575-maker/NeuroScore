"use client";

import { useState } from "react";
import VideoUpload from "@/components/video-upload";
import ScoreDisplay from "@/components/score-display";
import TabNavigation, { type TabId } from "@/components/tab-navigation";
import HooksTab from "@/components/hooks-tab";
import ScriptTab from "@/components/script-tab";
import type { AnalysisResponse, NichePreset } from "@/lib/api";

export default function Home() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null
  );
  const [showReupload, setShowReupload] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [niche, setNiche] = useState<NichePreset>("default");

  const handleGenerateHooks = () => {
    setActiveTab("hooks");
  };

  const handleGenerateScript = (hookText: string) => {
    setSelectedHook(hookText);
    setActiveTab("script");
  };

  const handleNavigateToAnalysis = () => {
    setActiveTab("analysis");
    setShowReupload(true);
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
                onNicheChange={(n) => setNiche(n as NichePreset)}
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
          niche={niche}
          onGenerateScript={handleGenerateScript}
        />
      )}

      {activeTab === "script" && selectedHook && videoId && (
        <ScriptTab
          videoId={videoId}
          selectedHook={selectedHook}
          niche={niche}
          onNavigateToAnalysis={handleNavigateToAnalysis}
        />
      )}
    </div>
  );
}
