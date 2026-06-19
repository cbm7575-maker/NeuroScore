import pytest

from app.services.network_fixes import (
    NETWORK_FIX_MAP,
    NETWORK_LABELS,
    build_prompt_context,
    get_fix_categories,
)

EXPECTED_NETWORKS = {"visual", "auditory", "language", "motion", "default_mode"}


class TestNetworkFixMap:
    def test_all_five_networks_defined(self):
        assert set(NETWORK_FIX_MAP.keys()) == EXPECTED_NETWORKS

    def test_each_network_has_four_fixes(self):
        for network, fixes in NETWORK_FIX_MAP.items():
            assert len(fixes) == 4, f"{network} should have 4 fix categories"

    def test_all_fixes_have_examples(self):
        for network, fixes in NETWORK_FIX_MAP.items():
            for fix in fixes:
                assert fix.name, f"Fix in {network} missing name"
                assert fix.description, f"Fix in {network} missing description"
                assert len(fix.examples) > 0, f"{network}/{fix.name} has no examples"

    def test_fix_names_are_unique_within_network(self):
        for network, fixes in NETWORK_FIX_MAP.items():
            names = [f.name for f in fixes]
            assert len(names) == len(set(names)), f"Duplicate fix names in {network}"

    def test_labels_exist_for_all_networks(self):
        assert set(NETWORK_LABELS.keys()) == EXPECTED_NETWORKS


class TestGetFixCategories:
    def test_valid_network(self):
        fixes = get_fix_categories("visual")
        assert len(fixes) == 4
        assert fixes[0].name == "change_angle"

    def test_case_insensitive(self):
        fixes = get_fix_categories("AUDITORY")
        assert len(fixes) == 4

    def test_space_to_underscore(self):
        fixes = get_fix_categories("default mode")
        assert len(fixes) == 4

    def test_unknown_network_raises(self):
        with pytest.raises(ValueError, match="Unknown network"):
            get_fix_categories("nonexistent")


class TestBuildPromptContext:
    def test_includes_all_networks_when_no_drops(self):
        result = build_prompt_context()
        for label in NETWORK_LABELS.values():
            assert label in result

    def test_includes_fix_names(self):
        result = build_prompt_context()
        assert "change_angle" in result
        assert "personal_story" in result

    def test_filters_to_specified_drops(self):
        drops = {"visual": [3.0, 7.5], "motion": [12.0]}
        result = build_prompt_context(drops)
        assert "Visual Network" in result
        assert "Motion Network" in result
        assert "Auditory Network" not in result

    def test_includes_timestamps(self):
        drops = {"visual": [3.0, 7.5]}
        result = build_prompt_context(drops)
        assert "3.0s" in result
        assert "7.5s" in result

    def test_has_preamble(self):
        result = build_prompt_context()
        assert "Network-to-Fix Mapping" in result

    def test_structured_for_llm(self):
        result = build_prompt_context()
        assert "###" in result
        assert "**" in result
        assert "e.g.," in result
