# DeployPilot backend (first slice)

Implemented: `DeploymentProvider` interface + `MockProvider`, repository analyzer, baseline security
scanner, and an API for analyze / deploy / status / SSE logs / cancel. Repository analysis returns
framework/build metadata, measured counts for uploaded files and source lines, detected JavaScript
dependencies, and evidence-based build/CI/container/manifest checks.
The `/analyze` endpoint accepts up to 5,000 files and 25 MB of UTF-8 file contents per request.
Not yet built: GitHub OAuth + GitHubService, Postgres models/migrations, and LLM service.

The analyzer and baseline scanner inspect the project files submitted to `/analyze`; they do not
invent sample metrics. The scanner is intentionally limited and is not a full security audit. The
mock provider simulates deployment locally; it does not build uploaded source code or change external
infrastructure. The dashboard labels this as a simulation, streams its logs, polls status, and can
cancel an in-progress run.

    pip install -r requirements.txt
    cp .env.example .env
    uvicorn app.main:app --reload
    python -m pytest tests      # or: python -m tests.test_core

Try the failure path: POST /deployments with `required_env: ["DATABASE_URL"]` and no `env`, then
stream GET /deployments/{id}/logs. Check GET /deployments/{id} for status or POST
/deployments/{id}/cancel to cancel an active run.
