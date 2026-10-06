from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.providers.base import DeploySpec
from app.providers.mock import MockProvider
from app.services import repository_analyzer, security_scanner

app = FastAPI(title="DeployPilot API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])
provider = MockProvider()  # swap via settings once a real provider exists


class AnalyzeIn(BaseModel):
    files: dict[str, str] = Field(..., description="path -> content (GitHubService will populate this)")


class DeployIn(BaseModel):
    repo: str
    branch: str = "main"
    build_command: str | None = None
    start_command: str | None = None
    required_env: list[str] = []
    env: dict[str, str] = {}


@app.post("/analyze")
async def analyze(body: AnalyzeIn):
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


@app.get("/deployments/{did}/logs")
async def logs(did: str):
    if did not in provider._d:
        raise HTTPException(404, "deployment not found")

    async def sse():
        async for line in provider.get_logs(did):
            yield f"data: {line}\n\n"
    return StreamingResponse(sse(), media_type="text/event-stream")
