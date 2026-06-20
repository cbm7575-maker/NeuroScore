from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.analysis import router as analysis_router
from app.routers.brain import router as brain_router
from app.routers.hooks import router as hooks_router
from app.routers.inference import router as inference_router
from app.routers.scores import router as scores_router
from app.routers.timeline import router as timeline_router
from app.routers.videos import router as videos_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="NeuroScore API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos_router)
app.include_router(inference_router)
app.include_router(analysis_router)
app.include_router(hooks_router)
app.include_router(scores_router)
app.include_router(timeline_router)
app.include_router(brain_router)
