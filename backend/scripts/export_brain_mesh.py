"""
Export fsaverage5 cortical surface mesh to a web-friendly JSON asset.

Usage:
    python backend/scripts/export_brain_mesh.py [--surface {inflated,pial,white}]

Output:
    frontend/public/brain_mesh.json

JSON schema:
    {
      "meta": {
        "mesh": "fsaverage5",
        "surface": "<name>",
        "n_vertices": 20484,
        "left":  {"vertex_offset": 0,     "vertex_count": 10242, "face_count": 20480},
        "right": {"vertex_offset": 10242, "vertex_count": 10242, "face_count": 20480}
      },
      "left":  {"vertices": [x,y,z,...], "faces": [i,j,k,...]},
      "right": {"vertices": [x,y,z,...], "faces": [i,j,k,...]}
    }

vertices — flat Float32 array (x,y,z per vertex), 2 decimal-place precision
faces    — flat Uint32 array (3 indices per triangle, local to hemisphere)

Three.js usage (BufferGeometry):
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hemi.vertices), 3));
    geo.setIndex(hemi.faces);
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_PATH = REPO_ROOT / "frontend" / "public" / "brain_mesh.json"
N_VERTICES_PER_HEMI = 10_242
N_TOTAL_VERTICES = N_VERTICES_PER_HEMI * 2  # 20,484


def load_hemisphere(surface_path: str) -> tuple[np.ndarray, np.ndarray]:
    """Load (coords, faces) from a GifTI surface file."""
    import nibabel as nib  # noqa: PLC0415

    gii = nib.load(surface_path)
    coords: np.ndarray = gii.darrays[0].data  # (N, 3) float32
    faces: np.ndarray = gii.darrays[1].data   # (F, 3) int32
    return coords, faces


def _flat_rounded(arr: np.ndarray, decimals: int = 2) -> list:
    """Flatten and round a numpy array to a plain Python list.

    Cast to float64 before rounding so float32 representation artifacts
    (e.g. -5.840000152587891 instead of -5.84) don't bloat the JSON.
    """
    return arr.astype(np.float64).flatten().round(decimals).tolist()


def export(surface: str = "inflated") -> None:
    try:
        from nilearn import datasets  # noqa: PLC0415
    except ImportError:
        print("ERROR: nilearn is required. pip install 'nilearn>=0.10'", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching fsaverage5 ({surface}) surface via nilearn…")
    t0 = time.perf_counter()
    fs5 = datasets.fetch_surf_fsaverage(mesh="fsaverage5")

    # nilearn uses abbreviated keys: inflated → infl, pial → pial, white → white
    key_prefix = "infl" if surface == "inflated" else surface
    coords_l, faces_l = load_hemisphere(fs5[f"{key_prefix}_left"])
    coords_r, faces_r = load_hemisphere(fs5[f"{key_prefix}_right"])

    # Validate vertex counts.
    assert coords_l.shape == (N_VERTICES_PER_HEMI, 3), coords_l.shape
    assert coords_r.shape == (N_VERTICES_PER_HEMI, 3), coords_r.shape
    n_total = coords_l.shape[0] + coords_r.shape[0]
    assert n_total == N_TOTAL_VERTICES, f"Expected {N_TOTAL_VERTICES}, got {n_total}"

    payload = {
        "meta": {
            "mesh": "fsaverage5",
            "surface": surface,
            "n_vertices": n_total,
            "left": {
                "vertex_offset": 0,
                "vertex_count": int(coords_l.shape[0]),
                "face_count": int(faces_l.shape[0]),
            },
            "right": {
                "vertex_offset": N_VERTICES_PER_HEMI,
                "vertex_count": int(coords_r.shape[0]),
                "face_count": int(faces_r.shape[0]),
            },
        },
        "left": {
            "vertices": _flat_rounded(coords_l),
            "faces": faces_l.flatten().tolist(),
        },
        "right": {
            "vertices": _flat_rounded(coords_r),
            "faces": faces_r.flatten().tolist(),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    json_bytes = json.dumps(payload, separators=(",", ":")).encode()
    OUTPUT_PATH.write_bytes(json_bytes)

    elapsed = time.perf_counter() - t0
    size_kb = len(json_bytes) / 1024
    print(f"Exported to {OUTPUT_PATH}")
    print(f"  Vertices : {n_total:,} total ({coords_l.shape[0]:,} L + {coords_r.shape[0]:,} R)")
    print(f"  Faces    : {faces_l.shape[0]:,} L + {faces_r.shape[0]:,} R")
    print(f"  File size: {size_kb:.0f} KB ({size_kb / 1024:.2f} MB)")
    print(f"  Elapsed  : {elapsed:.1f}s")

    # Benchmark: estimate gzip-compressed size.
    import gzip  # noqa: PLC0415
    compressed = gzip.compress(json_bytes, compresslevel=6)
    print(f"  Gzip     : {len(compressed) / 1024:.0f} KB (served with Content-Encoding: gzip)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--surface", choices=["inflated", "pial", "white"], default="inflated",
                        help="Which surface geometry to export (default: inflated)")
    args = parser.parse_args()
    export(args.surface)


if __name__ == "__main__":
    main()
