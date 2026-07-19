import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import CurrentUser

app = FastAPI(title="ResumeLab API", version="0.1.0")

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
