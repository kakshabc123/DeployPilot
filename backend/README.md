# DeployPilot backend (first slice)

Implemented: `DeploymentProvider` interface + `MockProvider`, repository analyzer, baseline security
scanner, and an API for analyze / deploy / status / SSE logs.
Not yet built: GitHub OAuth + GitHubService, Postgres models/migrations, LLM service, frontend.

    pip install -r requirements.txt
    cp .env.example .env
    uvicorn app.main:app --reload
    python -m pytest tests      # or: python -m tests.test_core

Try the failure path: POST /deployments with `required_env: ["DATABASE_URL"]` and no `env`, then
stream GET /deployments/{id}/logs.
