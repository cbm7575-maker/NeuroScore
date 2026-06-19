import VideoUpload from "@/components/video-upload";
import BrainViewer from "@/components/brain-viewer";

export default function Home() {
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
      <VideoUpload />

      {/* Brain visualisation — placeholder until analysis results are ready */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Neural activation
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Predicted cortical activation will update here at 1 Hz during playback
        </p>
        <BrainViewer className="mt-4 h-80" />
      </div>
    </div>
  );
}
