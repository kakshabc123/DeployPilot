import asyncio, json
from app.providers.base import DeploySpec, DeployStatus
from app.providers.mock import MockProvider
from app.services.repository_analyzer import analyze
from app.services.security_scanner import scan

FILES = {
    "package.json": json.dumps({"dependencies": {"next": "14", "react": "18"}, "scripts": {"build": "next build"}}),
    "package-lock.json": "{}", "tsconfig.json": "{}",
    "src/db.ts": "const u = process.env.DATABASE_URL; process.env.NODE_ENV",
    ".env": "X=1", "Dockerfile": "FROM node:latest\nCMD npm start",
}


def test_analyze():
    a = analyze(FILES)
    assert (a["framework"], a["language"], a["package_manager"], a["port"]) == ("Next.js", "TypeScript", "npm", 3000)
    assert a["build_command"] == "npm run build" and a["environment_variables"] == ["DATABASE_URL"]


def test_scan():
    titles = {i["title"] for i in scan(FILES)}
    assert {"Committed environment file", "Container runs as root", "Unpinned base image"} <= titles


def _run(env):
    async def go():
        p = MockProvider(0.01)
        i = await p.build(DeploySpec("o/r", "main", "npm run build", required_env=["DATABASE_URL"], env=env))
        await p.deploy(i)
        logs = [l async for l in p.get_logs(i)]
        return logs, await p.get_status(i)
    return asyncio.run(go())


def test_mock_fail_and_success():
    logs, st = _run({})
    assert st == DeployStatus.FAILED and any("DATABASE_URL" in l for l in logs)
    logs, st = _run({"DATABASE_URL": "x"})
    assert st == DeployStatus.LIVE and "Deployment successful" in logs[-1]


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
