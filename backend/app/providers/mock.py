from __future__ import annotations
import asyncio, uuid
from datetime import datetime
from typing import AsyncIterator
from .base import DeploymentProvider, DeploySpec, DeployStatus, TERMINAL


class MockProvider(DeploymentProvider):
    """Local, credential-free provider. Fails the build if required env vars are missing."""

    name = "mock"

    def __init__(self, step_delay: float = 0.3) -> None:
        self.delay = step_delay
        self._d: dict[str, dict] = {}

    def _log(self, i: str, msg: str) -> None:
        self._d[i]["logs"].append(f"[{datetime.now():%H:%M:%S}] {msg}")

    async def build(self, spec: DeploySpec) -> str:
        i = uuid.uuid4().hex[:12]
        self._d[i] = {"spec": spec, "status": DeployStatus.QUEUED, "logs": [], "task": None}
        self._d[i]["task"] = asyncio.create_task(self._build(i))
        return i

    async def _build(self, i: str) -> None:
        s: DeploySpec = self._d[i]["spec"]
        self._d[i]["status"] = DeployStatus.BUILDING
        self._log(i, f"Cloning {s.repo}@{s.branch}")
        await asyncio.sleep(self.delay)
        self._log(i, "Installing dependencies...")
        await asyncio.sleep(self.delay)
        self._log(i, f"Running build: {s.build_command or '(none)'}")
        await asyncio.sleep(self.delay)
        missing = [v for v in s.required_env if v not in s.env]
        if missing:
            self._log(i, f"ERROR: {missing[0]} is not defined")
            self._log(i, "Build failed with exit code 1")
            self._d[i]["status"] = DeployStatus.FAILED
            return
        self._log(i, "Build completed")

    async def deploy(self, build_id: str) -> str:
        self._d[build_id]["deploy_task"] = asyncio.create_task(self._deploy(build_id))
        return build_id

    async def _deploy(self, i: str) -> None:
        await self._d[i]["task"]
        if self._d[i]["status"] in TERMINAL:
            return
        for st, msg in [(DeployStatus.DEPLOYING, "Starting deployment..."),
                        (DeployStatus.VERIFYING, "Health check on /"),
                        (DeployStatus.LIVE, "Deployment successful")]:
            if self._d[i]["status"] == DeployStatus.CANCELED:
                return
            self._d[i]["status"] = st
            self._log(i, msg)
            await asyncio.sleep(self.delay)

    async def get_status(self, deployment_id: str) -> DeployStatus:
        return self._d[deployment_id]["status"]

    async def get_logs(self, deployment_id: str) -> AsyncIterator[str]:
        n = 0
        while True:
            d = self._d[deployment_id]
            while n < len(d["logs"]):
                yield d["logs"][n]
                n += 1
            if d["status"] in TERMINAL and n >= len(d["logs"]):
                return
            await asyncio.sleep(0.05)

    async def cancel(self, deployment_id: str) -> None:
        d = self._d[deployment_id]
        if d["status"] not in TERMINAL:
            d["status"] = DeployStatus.CANCELED
            self._log(deployment_id, "Canceled by user")

    async def rollback(self, deployment_id: str, target_id: str) -> str:
        self._log(deployment_id, f"Rolled back to {target_id}")
        return target_id
