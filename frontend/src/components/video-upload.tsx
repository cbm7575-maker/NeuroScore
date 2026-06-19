"use client";

import { useCallback, useRef, useState } from "react";
import { uploadVideo, type VideoMetadata } from "@/lib/api";

const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm", "avi"]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export default function VideoUpload() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(async (file: File) => {
    setError(null);
    setMetadata(null);

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setError(
        `Unsupported file type ".${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`
      );
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const response = await uploadVideo(file, setProgress);
      setMetadata(response.video);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndUpload(file);
    },
    [validateAndUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndUpload(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [validateAndUpload]
  );

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex cursor-pointer flex-col items-center justify-center
          rounded-xl border-2 border-dashed p-12 transition-all
          ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--border)] hover:border-[var(--text-secondary)]"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <svg
          className="mb-4 h-10 w-10 text-[var(--text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-[var(--text-secondary)]">
          Drag and drop your video here, or{" "}
          <span className="text-[var(--accent)]">browse</span>
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]/60">
          MP4, MOV, WebM, AVI
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.webm,.avi"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-[var(--text-secondary)]">
            Uploading... {progress}%
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Metadata display */}
      {metadata && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--success)]" />
            <span className="text-sm font-medium text-[var(--success)]">
              Upload complete
            </span>
          </div>
          <h3 className="mb-4 truncate text-lg font-medium">
            {metadata.original_filename}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetadataItem
              label="Duration"
              value={formatDuration(metadata.duration_seconds)}
            />
            <MetadataItem
              label="Resolution"
              value={`${metadata.width} x ${metadata.height}`}
            />
            <MetadataItem
              label="File Size"
              value={formatBytes(metadata.file_size_bytes)}
            />
            <MetadataItem
              label="Format"
              value={metadata.format.toUpperCase()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
