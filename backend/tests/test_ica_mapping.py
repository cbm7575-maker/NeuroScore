import numpy as np
import pytest

from app.services.ica_mapping import (
    NETWORKS,
    N_VERTICES,
    aggregate_to_networks,
    load_vertex_network_map,
)


def test_mapping_shape():
    mapping = load_vertex_network_map()
    assert mapping.shape == (N_VERTICES,)


def test_every_vertex_assigned_in_range():
    mapping = load_vertex_network_map()
    assert int(mapping.min()) >= 0
    assert int(mapping.max()) <= len(NETWORKS) - 1


def test_all_networks_populated():
    mapping = load_vertex_network_map()
    for net_idx, name in enumerate(NETWORKS):
        count = int((mapping == net_idx).sum())
        assert count > 0, f"Network '{name}' (index {net_idx}) has zero vertices"


def test_aggregate_output_shape():
    mapping = load_vertex_network_map()
    T = 30
    dummy = np.random.rand(T, N_VERTICES).astype(np.float32)
    result = aggregate_to_networks(dummy, mapping=mapping)
    assert result.shape == (T, len(NETWORKS))
    assert not np.any(np.isnan(result)), "Real mapping should produce no NaN columns"


def test_aggregate_values_within_input_range():
    mapping = load_vertex_network_map()
    T = 10
    data = np.random.rand(T, N_VERTICES).astype(np.float32)
    result = aggregate_to_networks(data, mapping=mapping)
    assert result.min() >= 0.0
    assert result.max() <= 1.0


def test_aggregate_constant_input():
    """Uniform activation → every network mean equals the constant."""
    mapping = load_vertex_network_map()
    T, value = 5, 2.5
    data = np.full((T, N_VERTICES), fill_value=value, dtype=np.float32)
    result = aggregate_to_networks(data, mapping=mapping)
    assert np.allclose(result, value)


def test_aggregate_empty_network_produces_nan():
    """A synthetic mapping with one network unrepresented yields NaN for that column."""
    synthetic = np.zeros(N_VERTICES, dtype=np.int8)  # all vertices → visual (0)
    T = 4
    data = np.ones((T, N_VERTICES), dtype=np.float32)
    result = aggregate_to_networks(data, mapping=synthetic)
    assert np.allclose(result[:, 0], 1.0)
    for net_idx in range(1, len(NETWORKS)):
        assert np.all(np.isnan(result[:, net_idx]))


def test_mapping_dtype():
    mapping = load_vertex_network_map()
    assert mapping.dtype == np.int8
