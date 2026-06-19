import VideoUpload from "@/components/video-upload";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Upload your video
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Upload a video to analyze its predicted neural engagement
        </p>
      </div>
      <VideoUpload />
    </div>
  );
}
