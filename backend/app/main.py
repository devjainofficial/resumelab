import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import CurrentUser
from app.billing import router as billing_router
from app.enhance import router as enhance_router
from app.outcomes import router as outcomes_router
from app.repair import router as repair_router
from app.resumes import router as resumes_router
from app.scores import router as scores_router
from app.versions import router as versions_router
from app.wizard import router as wizard_router

app = FastAPI(title="ResumeLab API", version="0.1.0")
app.include_router(resumes_router)
app.include_router(wizard_router)
app.include_router(versions_router)
app.include_router(scores_router)
app.include_router(repair_router)
app.include_router(enhance_router)
app.include_router(billing_router)
app.include_router(outcomes_router)

_default_origins = "http://localhost:3000,https://resumelabai.vercel.app"
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", _default_origins).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/me")
def me(user: dict = CurrentUser) -> dict:
    """Smoke endpoint proving backend-side auth: returns the caller's
    identity, 401 for anyone without a valid Supabase session."""
    return {"id": user.get("id"), "email": user.get("email")}
