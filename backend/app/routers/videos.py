import hashlib
from uuid import UUID

import numpy as np
from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas.brain import NetworkStats, VertexColorsResponse
from app.schemas.video import UploadResponse, VideoMetadata
from app.services.video import (
    compute_next_version,
    extract_metadata,
    get_video_path,
    list_versions,
    load_metadata,
    resolve_root_video_id,
    save_upload,
    validate_extension,
)

# Column order matches ica_mapping.NETWORKS and the (T, 5) activations.npy matrix
_NETWORK_NAMES = ("visual", "auditory", "language", "motion", "default_mode")

router = APIRouter(prefix="/api/videos", tags=["videos"])

MIME_MAP = {
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
    "avi": "video/x-msvideo",
}


@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    file: UploadFile,
    original_video_id: UUID | None = Form(default=None),
):
    if not file.filename or validate_extension(file.filename) is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed formats: mp4, mov, webm, avi",
        )

    try:
        video_path, video_id, ext = await save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    version = 1
    root_id: UUID | None = None
    if original_video_id is not None:
        root_id = resolve_root_video_id(original_video_id)
        version = compute_next_version(root_id)

    try:
        metadata = extract_metadata(
            video_path, video_id, file.filename, ext,
            version=version, original_video_id=root_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return UploadResponse(success=True, video=metadata)


@router.get("/{video_id}")
async def get_metadata(video_id: UUID):
    metadata = load_metadata(video_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return metadata


@router.get("/{video_id}/versions", response_model=list[VideoMetadata])
async def get_video_versions(video_id: UUID):
    meta = load_metadata(video_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return list_versions(video_id)


@router.get("/{video_id}/file")
async def get_video_file(video_id: UUID):
    path = get_video_path(video_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Video file not found")
    ext = path.suffix.lstrip(".")
    return FileResponse(path, media_type=MIME_MAP.get(ext, "application/octet-stream"))


@router.get("/{video_id}/vertex-colors", response_model=VertexColorsResponse)
async def get_vertex_colors(video_id: UUID):
    """Return per-second network activations for vertex coloring.

    If activations.npy exists (from TRIBE inference), real data is returned.
    Otherwise a deterministic synthetic time series is used for development.
    """
    metadata = load_metadata(video_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Video not found")

    activations_path = settings.upload_dir / str(video_id) / "activations.npy"
    if activations_path.exists():
        activations = np.load(str(activations_path))
        if activations.ndim != 2 or activations.shape[1] != 5:
            raise HTTPException(
                status_code=422,
                detail=f"activations.npy has unexpected shape {activations.shape}; expected (T, 5)",
            )
    else:
        activations = _mock_activations(video_id, int(metadata.duration_seconds))

    network_stats = {
        name: NetworkStats(
            min=float(activations[:, i].min()),
            max=float(activations[:, i].max()),
        )
        for i, name in enumerate(_NETWORK_NAMES)
    }

    return VertexColorsResponse(
        video_id=str(video_id),
        duration_seconds=float(activations.shape[0]),
        network_stats=network_stats,
        activations=activations.tolist(),
    )


def _mock_activations(video_id: UUID, duration_seconds: int) -> np.ndarray:
    """Deterministic sinusoidal (T, 5) activation matrix for development/testing."""
    digest = hashlib.sha256(str(video_id).encode()).digest()
    seed = int.from_bytes(digest[:8], "big")
    rng = np.random.default_rng(seed)

    T = max(1, duration_seconds)
    t = np.linspace(0, 4 * np.pi, T)
    activations = np.zeros((T, 5), dtype=np.float64)

    for i in range(5):
        freq = 0.3 + rng.random() * 1.5
        phase = rng.random() * 2 * np.pi
        base = 0.35 + rng.random() * 0.25
        amp = 0.15 + rng.random() * 0.25
        activations[:, i] = base + amp * np.sin(freq * t + phase)

    return np.clip(activations, 0.0, 1.0)
