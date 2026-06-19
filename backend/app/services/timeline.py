import numpy as np

from app.schemas.timeline import (
    Classification,
    NETWORK_COLUMN_ORDER,
    NetworkActivations,
    NetworkClassifications,
    TimelineEntry,
    TimelineThresholds,
    TimelineResult,
)


def _classify_network(
    values: np.ndarray,
    mean: float,
    std: float,
    thresholds: TimelineThresholds,
) -> list[Classification]:
    """Classify each timestep for a single network as spike, drop_off, or normal.

    Drop-offs require the activation to stay below the threshold for at least
    drop_min_duration_seconds consecutive seconds (run-length filter).
    """
    spike_cutoff = mean + thresholds.spike_sd_above * std
    drop_cutoff = mean - thresholds.drop_sd_below * std

    n = len(values)
    is_drop_candidate = values < drop_cutoff

    # Confirm drop-off runs that meet the minimum duration
    confirmed_drop = np.zeros(n, dtype=bool)
    i = 0
    while i < n:
        if is_drop_candidate[i]:
            run_start = i
            while i < n and is_drop_candidate[i]:
                i += 1
            if (i - run_start) >= thresholds.drop_min_duration_seconds:
                confirmed_drop[run_start:i] = True
        else:
            i += 1

    result: list[Classification] = []
    for t in range(n):
        if confirmed_drop[t]:
            result.append(Classification.drop_off)
        elif values[t] > spike_cutoff:
            result.append(Classification.spike)
        else:
            result.append(Classification.normal)
    return result


def analyze_timeline(
    activations: np.ndarray,
    thresholds: TimelineThresholds | None = None,
    video_id: str = "",
) -> TimelineResult:
    """Build a per-second timeline from a (T, 5) activation matrix.

    Columns must follow NETWORK_COLUMN_ORDER: visual, auditory, language, motion, default_mode.
    """
    if thresholds is None:
        thresholds = TimelineThresholds()

    if activations.ndim != 2 or activations.shape[1] != 5:
        raise ValueError(f"activations must be shape (T, 5), got {activations.shape}")

    T = activations.shape[0]
    means = activations.mean(axis=0)
    stds = activations.std(axis=0)

    per_network: list[list[Classification]] = [
        _classify_network(
            activations[:, col_idx],
            float(means[col_idx]),
            float(stds[col_idx]),
            thresholds,
        )
        for col_idx in range(5)
    ]

    entries: list[TimelineEntry] = []
    for t in range(T):
        acts = {name: float(activations[t, i]) for i, name in enumerate(NETWORK_COLUMN_ORDER)}
        cls = {name: per_network[i][t] for i, name in enumerate(NETWORK_COLUMN_ORDER)}
        affected = [name for name in NETWORK_COLUMN_ORDER if cls[name] != Classification.normal]

        entries.append(
            TimelineEntry(
                timestamp=float(t),
                activations=NetworkActivations(**acts),
                classifications=NetworkClassifications(**cls),
                affected_networks=affected,
            )
        )

    return TimelineResult(
        video_id=video_id,
        duration_seconds=float(T),
        thresholds=thresholds,
        timeline=entries,
    )
