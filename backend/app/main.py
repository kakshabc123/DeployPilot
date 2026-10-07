from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.providers.base import DeploySpec
from app.providers.mock import MockProvider
from app.services import repository_analyzer, security_scanner

app = FastAPI(title="DeployPilot API")
app.add_middleware(CORSMiddleware, allow_origins=[
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:3001", "http://127.0.0.1:3001",
    "http://localhost:3002", "http://127.0.0.1:3002",
],
                   allow_methods=["*"], allow_headers=["*"])
provider = MockProvider()  # swap via settings once a real provider exists


MAX_ANALYSIS_FILES = 5_000
MAX_ANALYSIS_BYTES = 25_000_000


class AnalyzeIn(BaseModel):
    files: dict[str, str] = Field(..., description="path -> content (GitHubService will populate this)")

    @field_validator("files")
    @classmethod
    def validate_upload_size(cls, files: dict[str, str]) -> dict[str, str]:
        if len(files) > MAX_ANALYSIS_FILES:
            raise ValueError(f"Project upload exceeds the {MAX_ANALYSIS_FILES:,}-file analysis limit.")
        total_bytes = sum(len(content.encode("utf-8")) for content in files.values())
        if total_bytes > MAX_ANALYSIS_BYTES:
            raise ValueError("Project upload exceeds the 25 MB analysis limit.")
        return files


class DeployIn(BaseModel):
    repo: str
    branch: str = "main"
    build_command: str | None = None
    start_command: str | None = None
    required_env: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)


@app.post("/analyze")
async def analyze(body: AnalyzeIn):
    if not body.files:
        raise HTTPException(422, "No readable project files were uploaded.")
    return {"analysis": repository_analyzer.analyze(body.files),
            "issues": security_scanner.scan(body.files),
            "label": security_scanner.BASELINE_LABEL}


@app.post("/deployments", status_code=202)
async def deploy(body: DeployIn):
    did = await provider.build(DeploySpec(**body.model_dump()))
    await provider.deploy(did)
    return {"id": did}


@app.get("/deployments/{did}")
async def status(did: str):
    try:
        return {"id": did, "status": await provider.get_status(did)}
    except KeyError:
        raise HTTPException(404, "deployment not found")


@app.post("/deployments/{did}/cancel", status_code=202)
async def cancel(did: str):
    try:
        await provider.cancel(did)
        return {"id": did, "status": await provider.get_status(did)}
    except KeyError:
        raise HTTPException(404, "deployment not found")


@app.get("/deployments/{did}/logs")
async def logs(did: str):
    try:
        await provider.get_status(did)
    except KeyError:
        raise HTTPException(404, "deployment not found")

    async def sse():
        async for line in provider.get_logs(did):
            yield f"data: {line}\n\n"
    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
