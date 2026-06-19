export interface VideoMetadata {
  id: string;
  original_filename: string;
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  file_size_bytes: number;
  format: string;
  created_at: string;
}

export interface UploadResponse {
  success: boolean;
  video: VideoMetadata;
}

const API_BASE = "/api";

export function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.detail || "Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));

    xhr.open("POST", `${API_BASE}/videos/upload`);
    xhr.send(formData);
  });
}

export async function getVideoMetadata(id: string): Promise<VideoMetadata> {
  const res = await fetch(`${API_BASE}/videos/${id}`);
  if (!res.ok) throw new Error("Failed to fetch video metadata");
  return res.json();
}

export interface NetworkScore {
  name: string;
  score: number;
  label: string;
}

export interface NetworkInterpretation {
  network: string;
  score: number;
  label: string;
  interpretation: string;
}

export interface DropOffDetail {
  timestamp: number;
  duration: number;
  network: string;
  description: string;
}

export interface Suggestion {
  timestamp: number | null;
  network: string | null;
  suggestion: string;
}

export interface StrengthHighlight {
  timestamp: number | null;
  network: string | null;
  description: string;
}

export interface AnalysisOutput {
  overall_assessment: string;
  network_interpretations: NetworkInterpretation[];
  drop_off_analysis: DropOffDetail[];
  suggestions: Suggestion[];
  strength_highlights: StrengthHighlight[];
}

export interface AnalysisResponse {
  success: boolean;
  video_id: string;
  network_scores: NetworkScore[];
  analysis: AnalysisOutput;
}

export async function runAnalysis(
  videoId: string,
  niche: string = "general"
): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/analysis/${videoId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niche }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Analysis failed");
  }
  return res.json();
}

export async function getAnalysis(videoId: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/analysis/${videoId}`);
  if (!res.ok) throw new Error("No analysis found for this video");
  return res.json();
}
