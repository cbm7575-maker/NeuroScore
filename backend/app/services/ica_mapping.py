"""
ICA vertex-to-network mapping for NeuroScore.

Assigns each of the 20,484 fsaverage5 cortical surface vertices to one of
five functional networks using the Destrieux surface parcellation.

Networks (index → name):
    0  visual           Primary and association visual cortex
    1  primary_auditory Primary auditory cortex and belt regions
    2  language         Perisylvian language network (Broca/Wernicke/STS)
    3  motion           Motor, premotor, and somatosensory cortex
    4  default_mode     Medial PFC, PCC/precuneus, angular gyrus, parahippocampal

Vertex ordering follows the TRIBE v2 / fsaverage5 convention:
    indices 0–10241      left hemisphere
    indices 10242–20483  right hemisphere

The mapping is built once from nilearn's Destrieux atlas and cached to disk
at backend/app/data/vertex_network_map.npy. Delete the file to force a rebuild.
"""

import logging
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

NETWORKS = ("visual", "primary_auditory", "language", "motion", "default_mode")
N_VERTICES = 20_484  # fsaverage5: 10,242 per hemisphere × 2

# Destrieux region name → network index (0–4).
# Label strings match nilearn 0.10+ exactly (underscores, no & characters).
# Any region not listed here defaults to 4 (default_mode).
_REGION_NETWORK: dict[str, int] = {
    # ── Visual (0) ─────────────────────────────────────────────────────────
    "G_and_S_occipital_inf":        0,
    "G_cuneus":                     0,
    "G_occipital_middle":           0,
    "G_occipital_sup":              0,
    "G_oc-temp_lat-fusifor":        0,  # fusiform / ventral visual stream
    "G_oc-temp_med-Lingual":        0,  # lingual gyrus
    "Pole_occipital":               0,
    "S_calcarine":                  0,  # primary visual cortex (V1)
    "S_oc-temp_lat":                0,
    "S_oc-temp_med_and_Lingual":    0,
    "S_oc_middle_and_Lunatus":      0,
    "S_oc_sup_and_transversal":     0,
    "S_occipital_ant":              0,
    "S_parieto_occipital":          0,
    # ── Primary Auditory (1) ───────────────────────────────────────────────
    "G_temp_sup-G_T_transv":        1,  # Heschl's gyrus (A1)
    "G_temp_sup-Plan_tempo":        1,  # planum temporale
    "G_temp_sup-Lateral":           1,  # auditory belt (A2/lateral STG)
    "G_Ins_lg_and_S_cent_ins":      1,  # long insular gyrus / posterior insula
    "S_circular_insula_inf":        1,
    "S_temporal_transverse":        1,
    # ── Language (2) ───────────────────────────────────────────────────────
    "G_front_inf-Opercular":        2,  # Broca's area (BA 44)
    "G_front_inf-Triangul":         2,  # Broca's area (BA 45)
    "G_front_inf-Orbital":          2,
    "G_pariet_inf-Angular":         2,  # angular gyrus (Wernicke region)
    "G_pariet_inf-Supramar":        2,  # supramarginal gyrus
    "G_temp_sup-Plan_polar":        2,  # planum polare
    "G_temporal_middle":            2,  # semantic / language association cortex
    "Lat_Fis-ant-Horizont":         2,
    "Lat_Fis-ant-Vertical":         2,
    "Lat_Fis-post":                 2,  # posterior Sylvian fissure
    "S_front_inf":                  2,
    "S_interm_prim-Jensen":         2,
    "S_intrapariet_and_P_trans":    2,
    "S_temporal_inf":               2,
    "S_temporal_sup":               2,  # superior temporal sulcus / Wernicke
    # ── Motion (3) ─────────────────────────────────────────────────────────
    "G_and_S_paracentral":          3,  # supplementary motor area (SMA)
    "G_and_S_subcentral":           3,
    "G_postcentral":                3,  # primary somatosensory cortex (S1)
    "G_precentral":                 3,  # primary motor cortex (M1)
    "S_central":                    3,  # central sulcus
    "S_circular_insula_sup":        3,  # superior circular sulcus (premotor)
    "S_postcentral":                3,
    "S_precentral-inf-part":        3,
    "S_precentral-sup-part":        3,
    # ── Default Mode (4) ───────────────────────────────────────────────────
    "G_and_S_cingul-Ant":           4,
    "G_and_S_cingul-Mid-Ant":       4,
    "G_and_S_cingul-Mid-Post":      4,
    "G_and_S_frontomargin":         4,
    "G_and_S_transv_frontopol":     4,
    "G_cingul-Post-dorsal":         4,
    "G_cingul-Post-ventral":        4,
    "G_front_middle":               4,
    "G_front_sup":                  4,
    "G_insular_short":              4,
    "G_oc-temp_med-Parahip":        4,  # parahippocampal gyrus
    "G_orbital":                    4,
    "G_parietal_sup":               4,
    "G_precuneus":                  4,  # precuneus (core DMN node)
    "G_rectus":                     4,
    "G_subcallosal":                4,
    "G_temporal_inf":               4,
    "Medial_wall":                  4,  # non-cortical medial wall vertices
    "Pole_temporal":                4,
    "S_cingul-Marginalis":          4,
    "S_circular_insula_ant":        4,
    "S_collat_transv_ant":          4,
    "S_collat_transv_post":         4,
    "S_front_middle":               4,
    "S_front_sup":                  4,
    "S_orbital-H_Shaped":           4,
    "S_orbital_lateral":            4,
    "S_orbital_med-olfact":         4,
    "S_pericallosal":               4,
    "S_suborbital":                 4,
    "S_subparietal":                4,
    "Unknown":                      4,  # unlabeled / medial wall fallback
}

_CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "vertex_network_map.npy"


def load_vertex_network_map() -> np.ndarray:
    """Return int8 (20484,) array mapping each vertex index to a network index 0–4."""
    if _CACHE_FILE.exists():
        mapping = np.load(_CACHE_FILE)
        if mapping.shape == (N_VERTICES,):
            return mapping
        log.warning("Stale cache at %s (shape %s); rebuilding.", _CACHE_FILE, mapping.shape)
    return _build_and_cache()


def _build_and_cache() -> np.ndarray:
    try:
        from nilearn import datasets  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError(
            "nilearn is required to build the vertex-to-network map. "
            "Install it with: pip install 'nilearn>=0.10'"
        ) from exc

    log.info("Fetching Destrieux surface atlas from nilearn (first run only)…")
    destrieux = datasets.fetch_atlas_surf_destrieux()

    raw_labels = destrieux["labels"]
    label_names: list[str] = [
        lbl.decode() if isinstance(lbl, bytes) else str(lbl) for lbl in raw_labels
    ]

    mapping = np.full(N_VERTICES, fill_value=4, dtype=np.int8)  # DMN as default

    for hemi_data, offset in (
        (destrieux["map_left"], 0),
        (destrieux["map_right"], 10_242),
    ):
        for local_idx, label_code in enumerate(hemi_data):
            region = label_names[label_code] if 0 <= label_code < len(label_names) else ""
            mapping[offset + local_idx] = _REGION_NETWORK.get(region, 4)

    _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    np.save(_CACHE_FILE, mapping)
    log.info("Vertex-to-network map cached at %s", _CACHE_FILE)
    _log_coverage(mapping)
    return mapping


def _log_coverage(mapping: np.ndarray) -> None:
    for net_idx, name in enumerate(NETWORKS):
        count = int((mapping == net_idx).sum())
        pct = count / N_VERTICES * 100
        log.info("  %-20s %5d vertices (%4.1f%%)", name, count, pct)


def aggregate_to_networks(
    vertex_matrix: np.ndarray,
    mapping: np.ndarray | None = None,
) -> np.ndarray:
    """
    Reduce a (T, 20484) vertex activation matrix to a (T, 5) network matrix.

    Args:
        vertex_matrix: float array of shape (T, 20484).
        mapping:       preloaded mapping array; loaded from cache if None.

    Returns:
        float64 (T, 5) array — columns ordered as NETWORKS tuple.
        Networks with no assigned vertices produce NaN for that column.
    """
    if mapping is None:
        mapping = load_vertex_network_map()

    T = vertex_matrix.shape[0]
    result = np.full((T, len(NETWORKS)), fill_value=np.nan, dtype=np.float64)
    for net_idx in range(len(NETWORKS)):
        mask = mapping == net_idx
        if mask.any():
            result[:, net_idx] = vertex_matrix[:, mask].mean(axis=1)
    return result
