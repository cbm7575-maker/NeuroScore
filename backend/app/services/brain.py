"""Brain surface mesh loader — serves pial surface geometry to the frontend visualizer."""
import json
import logging
from pathlib import Path

import numpy as np

from app.services.ica_mapping import load_vertex_network_map

log = logging.getLogger(__name__)

_CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "brain_surface.json"
_N_VERTS_PER_HEMI = 10_242


def get_surface_json() -> dict:
    """Return pial surface mesh with vertex network assignments, cached after first build."""
    if _CACHE_FILE.exists():
        return json.loads(_CACHE_FILE.read_text())
    return _build_and_cache()


def _build_and_cache() -> dict:
    try:
        from nilearn import datasets, surface  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "nilearn is required. Install with: pip install 'nilearn>=0.10'"
        ) from exc

    log.info("Fetching fsaverage5 pial surface from nilearn (first run only)…")
    fsaverage = datasets.fetch_surf_fsaverage("fsaverage5")

    mesh_l = surface.load_surf_mesh(fsaverage.pial_left)
    mesh_r = surface.load_surf_mesh(fsaverage.pial_right)

    coords_l = np.asarray(mesh_l.coordinates, dtype=np.float32)
    faces_l = np.asarray(mesh_l.faces, dtype=np.int32)
    coords_r = np.asarray(mesh_r.coordinates, dtype=np.float32)
    faces_r = np.asarray(mesh_r.faces, dtype=np.int32)

    mapping = load_vertex_network_map()

    data = {
        "left": {
            "coords": coords_l.tolist(),
            "faces": faces_l.tolist(),
            "network_map": mapping[:_N_VERTS_PER_HEMI].tolist(),
        },
        "right": {
            "coords": coords_r.tolist(),
            "faces": faces_r.tolist(),
            "network_map": mapping[_N_VERTS_PER_HEMI:].tolist(),
        },
    }

    _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_FILE.write_text(json.dumps(data))
    log.info("Brain surface cached at %s", _CACHE_FILE)
    return data
