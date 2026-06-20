from pydantic import BaseModel


class NetworkScore(BaseModel):
    name: str
    score: float
    label: str


class TimelinePoint(BaseModel):
    timestamp: float
    scores: dict[str, float]


class SpikeEvent(BaseModel):
    timestamp: float
    network: str
    score: float


class DropOffEvent(BaseModel):
    timestamp: float
    network: str
    score: float
    duration: float


class NetworkInterpretation(BaseModel):
    network: str
    score: float
    label: str
    interpretation: str


class DropOffDetail(BaseModel):
    timestamp: float
    duration: float
    network: str
    description: str


class Suggestion(BaseModel):
    timestamp: float | None
    network: str | None
    suggestion: str


class StrengthHighlight(BaseModel):
    timestamp: float | None
    network: str | None
    description: str


class AnalysisOutput(BaseModel):
    overall_assessment: str
    network_interpretations: list[NetworkInterpretation]
    drop_off_analysis: list[DropOffDetail]
    suggestions: list[Suggestion]
    strength_highlights: list[StrengthHighlight]


class AnalysisRequest(BaseModel):
    niche: str = "general"


class AnalysisResponse(BaseModel):
    success: bool
    video_id: str
    network_scores: list[NetworkScore]
    analysis: AnalysisOutput
    timeline: list[TimelinePoint] = []
    spikes: list[SpikeEvent] = []
    drop_offs: list[DropOffEvent] = []


class ComparisonNetworkDelta(BaseModel):
    network: str
    v1_score: float
    v2_score: float
    delta: float
    commentary: str


class ComparisonFixedIssue(BaseModel):
    timestamp: float
    network: str
    description: str


class ComparisonPersistentIssue(BaseModel):
    timestamp: float
    network: str
    description: str


class ComparisonOutput(BaseModel):
    summary: str
    improvements: list[ComparisonNetworkDelta]
    regressions: list[ComparisonNetworkDelta]
    fixed_issues: list[ComparisonFixedIssue]
    persistent_issues: list[ComparisonPersistentIssue]
    recommendations: list[str]


class ComparisonResponse(BaseModel):
    success: bool
    video_id: str
    original_video_id: str
    comparison: ComparisonOutput


class HookOption(BaseModel):
    hook_text: str
    target_networks: list[str]
    neural_weaknesses_addressed: list[str]
    preserved_elements: list[str]
    explanation: str


class HookGenerationRequest(BaseModel):
    niche: str = "general"
    current_hook: str | None = None


class HookGenerationResponse(BaseModel):
    success: bool
    video_id: str
    hooks: list[HookOption]
    opening_scores: dict[str, float]
    neural_weaknesses: list[str]
    neural_strengths: list[str]
