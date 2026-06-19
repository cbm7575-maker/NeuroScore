from pydantic import BaseModel


class BrainMeshResponse(BaseModel):
    n_vertices: int
    n_faces: int
    vertices: list[float]          # flat x0,y0,z0, x1,y1,z1, ...
    faces: list[int]               # flat a0,b0,c0, a1,b1,c1, ...
    vertex_network_map: list[int]  # 20484 ints, network index 0–4


class NetworkStats(BaseModel):
    min: float
    max: float


class VertexColorsResponse(BaseModel):
    video_id: str
    duration_seconds: float
    network_stats: dict[str, NetworkStats]  # per-network min/max for normalization
    activations: list[list[float]]          # T × 5 per-network activations
