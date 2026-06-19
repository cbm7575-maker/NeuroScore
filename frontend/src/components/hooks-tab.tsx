"use client";

import type { AnalysisResponse } from "@/lib/api";

interface HooksTabProps {
  videoId: string;
  analysisResult: AnalysisResponse;
}

export default function HooksTab({ videoId, analysisResult }: HooksTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Generate Hooks
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          AI-generated hook options based on your neural engagement analysis
        </p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/10">
          <svg
            className="h-6 w-6 text-[var(--accent)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Hook generation coming soon. Analysis data for video{" "}
          <span className="font-mono text-[var(--accent)]">
            {videoId.slice(0, 8)}
          </span>{" "}
          with {analysisResult.network_scores.length} network scores is ready.
        </p>
      </div>
    </div>
  );
}
