from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator


class DeployStatus(str, Enum):
    QUEUED = "queued"
    BUILDING = "building"
    DEPLOYING = "deploying"
    VERIFYING = "verifying"
    LIVE = "live"
    FAILED = "failed"
    CANCELED = "canceled"


TERMINAL = {DeployStatus.LIVE, DeployStatus.FAILED, DeployStatus.CANCELED}


@dataclass
class DeploySpec:
    repo: str
    branch: str
    build_command: str | None = None
    start_command: str | None = None
    required_env: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)  # values are never logged


class DeploymentProvider(ABC):
    """Swap providers by implementing this interface (Railway, Fly, a Docker host...)."""

    name: str

    @abstractmethod
    async def build(self, spec: DeploySpec) -> str: ...
    @abstractmethod
    async def deploy(self, build_id: str) -> str: ...
    @abstractmethod
    async def get_status(self, deployment_id: str) -> DeployStatus: ...
    @abstractmethod
    def get_logs(self, deployment_id: str) -> AsyncIterator[str]: ...
    @abstractmethod
    async def cancel(self, deployment_id: str) -> None: ...
    @abstractmethod
    async def rollback(self, deployment_id: str, target_id: str) -> str: ...
