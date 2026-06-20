import numpy as np
import pytest

from app.services.network import (
    N_NETWORKS,
    N_VERTICES,
    NETWORK_NAMES,
    aggregate_to_networks,
    load_ica_mapping,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uniform_mapping() -> np.ndarray:
    """Distribute vertices as evenly as possible across all networks."""
    mapping = np.zeros(N_VERTICES, dtype=np.intp)
    chunk = N_VERTICES // N_NETWORKS
    for n in range(N_NETWORKS):
        start = n * chunk
        end = start + chunk if n < N_NETWORKS - 1 else N_VERTICES
        mapping[start:end] = n
    return mapping


# ---------------------------------------------------------------------------
# load_ica_mapping
# ---------------------------------------------------------------------------

def test_load_valid_mapping(tmp_path):
    mapping = np.arange(N_VERTICES, dtype=np.int32) % N_NETWORKS
    path = tmp_path / "mapping.npy"
    np.save(path, mapping)

    loaded = load_ica_mapping(path)
    assert loaded.shape == (N_VERTICES,)
    assert loaded.dtype == np.intp
    np.testing.assert_array_equal(loaded, mapping.astype(np.intp))


def test_load_wrong_shape_raises(tmp_path):
    path = tmp_path / "mapping.npy"
    np.save(path, np.zeros(100, dtype=np.int32))
    with pytest.raises(ValueError, match="shape"):
        load_ica_mapping(path)


def test_load_out_of_range_raises(tmp_path):
    mapping = np.full(N_VERTICES, N_NETWORKS, dtype=np.int32)  # N_NETWORKS is out of range
    path = tmp_path / "mapping.npy"
    np.save(path, mapping)
    with pytest.raises(ValueError, match="values must be"):
        load_ica_mapping(path)


def test_load_negative_value_raises(tmp_path):
    mapping = np.zeros(N_VERTICES, dtype=np.int32)
    mapping[0] = -1
    path = tmp_path / "mapping.npy"
    np.save(path, mapping)
    with pytest.raises(ValueError):
        load_ica_mapping(path)


# ---------------------------------------------------------------------------
# aggregate_to_networks — output shape
# ---------------------------------------------------------------------------

def test_aggregate_output_shape():
    T = 10
    result = aggregate_to_networks(np.random.randn(T, N_VERTICES), _uniform_mapping())
    assert result.shape == (T, N_NETWORKS)


def test_aggregate_zero_timesteps():
    """Zero-length video produces (0, 5) without error."""
    result = aggregate_to_networks(np.empty((0, N_VERTICES)), _uniform_mapping())
    assert result.shape == (0, N_NETWORKS)


def test_aggregate_single_timestep():
    """Single-row video produces (1, 5)."""
    result = aggregate_to_networks(np.ones((1, N_VERTICES)), _uniform_mapping())
    assert result.shape == (1, N_NETWORKS)


# ---------------------------------------------------------------------------
# aggregate_to_networks — correctness
# ---------------------------------------------------------------------------

def test_aggregate_uniform_activation_equals_that_value():
    """When every vertex has the same value, every network mean equals that value."""
    vertex_matrix = np.full((4, N_VERTICES), 3.7)
    result = aggregate_to_networks(vertex_matrix, _uniform_mapping())
    np.testing.assert_allclose(result, 3.7)


def test_aggregate_per_network_mean():
    """Each column is the correct mean of its assigned vertices."""
    mapping = _uniform_mapping()
    chunk = N_VERTICES // N_NETWORKS
    vertex_matrix = np.zeros((1, N_VERTICES))
    expected = np.zeros((1, N_NETWORKS))

    for n in range(N_NETWORKS):
        start = n * chunk
        end = start + chunk if n < N_NETWORKS - 1 else N_VERTICES
        vertex_matrix[0, start:end] = float(n + 1)
        expected[0, n] = float(n + 1)

    result = aggregate_to_networks(vertex_matrix, mapping)
    np.testing.assert_allclose(result, expected)


def test_aggregate_columns_match_network_order():
    """Column n corresponds to network n, not some other ordering."""
    mapping = np.zeros(N_VERTICES, dtype=np.intp)  # all vertices → network 0
    vertex_matrix = np.ones((2, N_VERTICES)) * 5.0
    result = aggregate_to_networks(vertex_matrix, mapping)
    np.testing.assert_allclose(result[:, 0], 5.0)
    # Networks 1-4 have no vertices → 0.0
    np.testing.assert_allclose(result[:, 1:], 0.0)


def test_aggregate_network_labels_correct():
    """NETWORK_NAMES has exactly the five expected labels, keyed 0-4."""
    assert set(NETWORK_NAMES.keys()) == set(range(N_NETWORKS))
    expected_labels = {"visual", "auditory", "language", "motion", "default_mode"}
    assert set(NETWORK_NAMES.values()) == expected_labels


# ---------------------------------------------------------------------------
# aggregate_to_networks — edge cases
# ---------------------------------------------------------------------------

def test_aggregate_empty_network_returns_zero():
    """A network with no assigned vertices produces 0.0 for every timestep."""
    mapping = np.zeros(N_VERTICES, dtype=np.intp)  # all → network 0
    result = aggregate_to_networks(np.ones((3, N_VERTICES)), mapping)
    np.testing.assert_allclose(result[:, 1:], 0.0)


def test_aggregate_single_vertex_per_network():
    """One vertex per network: mean equals that vertex's value."""
    mapping = np.zeros(N_VERTICES, dtype=np.intp)
    # Assign exactly one vertex to each of the five networks
    for n in range(N_NETWORKS):
        mapping[n] = n
    vertex_matrix = np.zeros((1, N_VERTICES))
    for n in range(N_NETWORKS):
        vertex_matrix[0, n] = float(n * 10)

    result = aggregate_to_networks(vertex_matrix, mapping)
    # Networks 0-4: one vertex each with values 0, 10, 20, 30, 40
    for n in range(N_NETWORKS):
        assert abs(result[0, n] - float(n * 10)) < 1e-9


# ---------------------------------------------------------------------------
# aggregate_to_networks — invalid inputs
# ---------------------------------------------------------------------------

def test_aggregate_bad_vertex_dimension_raises():
    with pytest.raises(ValueError, match="vertex_matrix shape"):
        aggregate_to_networks(np.zeros((5, 100)), np.zeros(100, dtype=np.intp))


def test_aggregate_1d_matrix_raises():
    with pytest.raises(ValueError):
        aggregate_to_networks(np.zeros(N_VERTICES), _uniform_mapping())


def test_aggregate_wrong_mapping_shape_raises():
    with pytest.raises(ValueError, match="ica_mapping shape"):
        aggregate_to_networks(np.zeros((3, N_VERTICES)), np.zeros(100, dtype=np.intp))
