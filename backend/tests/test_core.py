import asyncio, json
from fastapi.testclient import TestClient
from app import main as api
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
    assert a["stats"] == {
        "files_analyzed": len(FILES),
        "source_files": 1,
        "source_lines": 1,
        "declared_dependencies": 2,
    }
    assert {check["key"]: check["status"] for check in a["checks"]} == {
        "build": "ready", "ci": "attention", "container": "ready", "manifest": "ready",
    }


def test_analyze_handles_invalid_package_manifest_and_empty_upload():
    result = analyze({"package.json": "{invalid"})
    manifest = next(check for check in result["checks"] if check["key"] == "manifest")
    assert manifest["status"] == "attention"
    assert result["stats"]["declared_dependencies"] is None

    malformed_metadata = analyze({
        "package.json": json.dumps({"dependencies": None, "devDependencies": [], "engines": "node"}),
    })
    assert malformed_metadata["stats"]["declared_dependencies"] == 0
    assert malformed_metadata["runtime_version"] is None

    with TestClient(api.app) as client:
        response = client.post("/analyze", json={"files": {}})
    assert response.status_code == 422


def test_analyze_limits_oversized_project_upload_and_allows_port_3002():
    with TestClient(api.app) as client:
        oversized = client.post("/analyze", json={"files": {"src/app.js": "x" * (25_000_001)}})
        too_many_files = client.post(
            "/analyze",
            json={"files": {f"src/{index}.js": "x" for index in range(5_001)}},
        )
        cors = client.options(
            "/analyze",
            headers={
                "Origin": "http://localhost:3002",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert oversized.status_code == 422
    assert too_many_files.status_code == 422
    assert cors.status_code == 200
    assert cors.headers["access-control-allow-origin"] == "http://localhost:3002"


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


def test_deployment_api_streams_logs_and_reports_status(monkeypatch):
    monkeypatch.setattr(api, "provider", MockProvider(step_delay=0.001))
    with TestClient(api.app) as client:
        response = client.post("/deployments", json={
            "repo": "sample-app",
            "branch": "local",
            "required_env": ["DATABASE_URL"],
            "env": {"DATABASE_URL": "private-value"},
        })
        assert response.status_code == 202
        deployment_id = response.json()["id"]

        logs = client.get(f"/deployments/{deployment_id}/logs")
        assert logs.status_code == 200
        assert "Deployment successful" in logs.text
        assert "private-value" not in logs.text
        assert client.get(f"/deployments/{deployment_id}").json()["status"] == "live"


def test_deployment_api_reports_missing_env_and_supports_cancel(monkeypatch):
    monkeypatch.setattr(api, "provider", MockProvider(step_delay=0.1))
    with TestClient(api.app) as client:
        failed = client.post("/deployments", json={
            "repo": "sample-app",
            "required_env": ["DATABASE_URL"],
        })
        assert failed.status_code == 202
        failed_id = failed.json()["id"]
        failed_logs = client.get(f"/deployments/{failed_id}/logs")
        assert "DATABASE_URL is not defined" in failed_logs.text
        assert client.get(f"/deployments/{failed_id}").json()["status"] == "failed"

        canceled = client.post("/deployments", json={"repo": "sample-app"})
        canceled_id = canceled.json()["id"]
        response = client.post(f"/deployments/{canceled_id}/cancel")
        assert response.status_code == 202
        assert response.json()["status"] == "canceled"
        assert "Canceled by user" in client.get(f"/deployments/{canceled_id}/logs").text


def test_frontend_dev_origin_is_allowed_by_cors():
    with TestClient(api.app) as client:
        response = client.options(
            "/analyze",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
