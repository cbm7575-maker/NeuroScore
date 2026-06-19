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
