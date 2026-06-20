from pathlib import Path

import numpy as np

N_NETWORKS = 5
N_VERTICES = 20484

NETWORK_NAMES: dict[int, str] = {
    0: "visual",
    1: "auditory",
    2: "language",
    3: "motion",
    4: "default_mode",
}


def load_ica_mapping(path: Path) -> np.ndarray:
    """Load vertex-to-network assignment from a .npy file.

    Returns shape (20484,) integer array with values in [0, N_NETWORKS).
    """
    mapping = np.load(path)
    if mapping.shape != (N_VERTICES,):
        raise ValueError(f"Expected ICA mapping shape ({N_VERTICES},), got {mapping.shape}")
    mapping = mapping.astype(np.intp)
    if not np.all((mapping >= 0) & (mapping < N_NETWORKS)):
        raise ValueError(f"ICA mapping values must be in [0, {N_NETWORKS})")
    return mapping


def aggregate_to_networks(vertex_matrix: np.ndarray, ica_mapping: np.ndarray) -> np.ndarray:
    """Reduce (T, 20484) vertex activation matrix to (T, 5) network signals.

    Each output column is the mean activation of all vertices assigned to that
    network at that timestep.  Networks with no assigned vertices produce 0.0.

    Returns array of shape (T, N_NETWORKS).
    """
    if vertex_matrix.ndim != 2 or vertex_matrix.shape[1] != N_VERTICES:
        raise ValueError(
            f"Expected vertex_matrix shape (T, {N_VERTICES}), got {vertex_matrix.shape}"
        )
    if ica_mapping.shape != (N_VERTICES,):
        raise ValueError(
            f"Expected ica_mapping shape ({N_VERTICES},), got {ica_mapping.shape}"
        )

    T = vertex_matrix.shape[0]
    result = np.empty((T, N_NETWORKS), dtype=np.float64)

    for n in range(N_NETWORKS):
        mask = ica_mapping == n
        if mask.any():
            result[:, n] = vertex_matrix[:, mask].mean(axis=1)
        else:
            result[:, n] = 0.0

    return result
