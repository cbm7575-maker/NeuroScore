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

export type NichePreset = "default" | "comedy" | "education" | "fitness" | "custom";

export interface NicheWeights {
  auditory: number;
  language: number;
  visual: number;
  default_mode: number;
  motion: number;
}

export interface NetworkScores {
  auditory: number;
  language: number;
  visual: number;
  default_mode: number;
  motion: number;
}

export interface CompositeScoreResponse {
  composite_score: number;
  network_scores: NetworkScores;
  weights_used: NicheWeights;
  preset: NichePreset;
}

export interface BrainHemisphere {
  coords: [number, number, number][];
  faces: [number, number, number][];
  network_map: number[];
}

export interface BrainSurfaceData {
  left: BrainHemisphere;
  right: BrainHemisphere;
}

export interface VertexColorsData {
  video_id: string;
  duration_seconds: number;
  network_stats: Record<string, { min: number; max: number }>;
  activations: number[][];  // T × 5, one row per second
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

let _surfaceCache: BrainSurfaceData | null = null;

export async function getBrainSurface(): Promise<BrainSurfaceData> {
  if (_surfaceCache) return _surfaceCache;
  const res = await fetch(`${API_BASE}/brain/surface`);
  if (!res.ok) throw new Error("Failed to load brain surface");
  _surfaceCache = await res.json();
  return _surfaceCache!;
}

export async function getVertexColors(videoId: string): Promise<VertexColorsData> {
  const res = await fetch(`${API_BASE}/videos/${videoId}/vertex-colors`);
  if (!res.ok) throw new Error("Failed to load vertex colors");
  return res.json();
}

export async function getVideoMetadata(id: string): Promise<VideoMetadata> {
  const res = await fetch(`${API_BASE}/videos/${id}`);
  if (!res.ok) throw new Error("Failed to fetch video metadata");
  return res.json();
}

export async function getCompositeScore(
  videoId: string,
  preset: NichePreset,
  customWeights?: NicheWeights
): Promise<CompositeScoreResponse> {
  const body: { preset: NichePreset; custom_weights?: NicheWeights } = { preset };
  if (preset === "custom" && customWeights) body.custom_weights = customWeights;

  const res = await fetch(`${API_BASE}/scores/${videoId}/composite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to calculate score");
  }
  return res.json();
}
