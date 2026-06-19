import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import cv2
from fastapi import UploadFile

from app.config import settings
from app.schemas.video import VideoMetadata


def validate_extension(filename: str) -> str | None:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in settings.allowed_extensions:
        return None
    return ext


async def save_upload(file: UploadFile) -> tuple[Path, UUID, str]:
    video_id = uuid4()
    ext = validate_extension(file.filename or "")
    if ext is None:
        raise ValueError(f"Unsupported file type. Allowed: {', '.join(sorted(settings.allowed_extensions))}")

    video_dir = settings.upload_dir / str(video_id)
    video_dir.mkdir(parents=True, exist_ok=True)
    video_path = video_dir / f"video.{ext}"

    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return video_path, video_id, ext


def extract_metadata(video_path: Path, video_id: UUID, original_filename: str, ext: str) -> VideoMetadata:
    cap = cv2.VideoCapture(str(video_path))
    try:
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video file: {video_path.name}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0.0
    finally:
        cap.release()

    file_size = video_path.stat().st_size

    metadata = VideoMetadata(
        id=video_id,
        original_filename=original_filename,
        duration_seconds=round(duration, 2),
        width=width,
        height=height,
        fps=round(fps, 2),
        file_size_bytes=file_size,
        format=ext,
        created_at=datetime.now(timezone.utc),
    )

    metadata_path = video_path.parent / "metadata.json"
    metadata_path.write_text(json.dumps(metadata.model_dump(mode="json"), indent=2, default=str))

    return metadata


def load_metadata(video_id: UUID) -> VideoMetadata | None:
    metadata_path = settings.upload_dir / str(video_id) / "metadata.json"
    if not metadata_path.exists():
        return None
    data = json.loads(metadata_path.read_text())
    return VideoMetadata(**data)


def get_video_path(video_id: UUID) -> Path | None:
    video_dir = settings.upload_dir / str(video_id)
    if not video_dir.exists():
        return None
    for ext in settings.allowed_extensions:
        candidate = video_dir / f"video.{ext}"
        if candidate.exists():
            return candidate
    return None
