from __future__ import annotations
import json, re
from typing import Any

ENV_RE = [re.compile(r"process\.env\.([A-Z][A-Z0-9_]+)"),
          re.compile(r"os\.environ(?:\.get)?[\[(]\s*['\"]([A-Z][A-Z0-9_]+)"),
          re.compile(r"os\.getenv\(\s*['\"]([A-Z][A-Z0-9_]+)")]
SRC_EXT = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".py")
SKIP_ENV = {"NODE_ENV", "PORT", "PATH", "HOME", "CI"}


def _package_manager(files: dict[str, str]) -> str | None:
    for lock, pm in [("pnpm-lock.yaml", "pnpm"), ("yarn.lock", "yarn"), ("bun.lockb", "bun"),
                     ("package-lock.json", "npm"), ("poetry.lock", "poetry"), ("uv.lock", "uv")]:
        if lock in files:
            return pm
    if "package.json" in files:
        return "npm"
    return "pip" if ("requirements.txt" in files or "pyproject.toml" in files) else None


def analyze(files: dict[str, str]) -> dict[str, Any]:
    """Pure function: {path: content} -> normalized analysis. Fetching is GitHubService's job."""
    pkg: dict = {}
    if "package.json" in files:
        try:
            pkg = json.loads(files["package.json"])
        except json.JSONDecodeError:
            pass
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    py = (files.get("requirements.txt", "") + files.get("pyproject.toml", "")).lower()
    scripts = pkg.get("scripts", {})
    pm = _package_manager(files)
    run = {"npm": "npm run", "pnpm": "pnpm", "yarn": "yarn", "bun": "bun run"}.get(pm or "", "npm run")

    fw, lang, port, start = None, None, None, None
    build = f"{run} build" if "build" in scripts else None
    if "next" in deps:
        fw, port, start = "Next.js", 3000, "npm start" if pm == "npm" else f"{pm} start"
    elif "vite" in deps:
        fw, port, start = "Vite", 5173, f"{run} preview" if "preview" in scripts else None
    elif "express" in deps:
        fw, port, start = "Express", 3000, f"{run} start" if "start" in scripts else None
    elif "react" in deps:
        fw, port = "React", 3000
    elif pkg:
        fw, port, start = "Node.js", 3000, f"{run} start" if "start" in scripts else None
    elif "fastapi" in py:
        fw, port, start = "FastAPI", 8000, "uvicorn app.main:app --host 0.0.0.0 --port 8000"
    elif "django" in py:
        fw, port, start = "Django", 8000, "gunicorn config.wsgi --bind 0.0.0.0:8000"
    elif "flask" in py:
        fw, port, start = "Flask", 5000, "gunicorn app:app --bind 0.0.0.0:5000"
    elif "flutter" in files.get("pubspec.yaml", ""):
        fw, lang, build = "Flutter", "Dart", "flutter build apk"
    elif py:
        fw = "Python"

    if pkg:
        lang = "TypeScript" if "tsconfig.json" in files or "typescript" in deps else "JavaScript"
    elif py:
        lang = "Python"

    env: set[str] = set()
    for path, text in files.items():
        if path.endswith(SRC_EXT):
            for rx in ENV_RE:
                env.update(rx.findall(text))
    for line in files.get(".env.example", "").splitlines():
        m = re.match(r"\s*([A-Z][A-Z0-9_]*)\s*=", line)
        if m:
            env.add(m.group(1))

    return {
        "framework": fw, "language": lang, "package_manager": pm,
        "build_command": build, "start_command": start, "port": port,
        "runtime_version": (pkg.get("engines") or {}).get("node"),
        "has_dockerfile": "Dockerfile" in files,
        "has_ci": any(p.startswith(".github/workflows/") for p in files),
        "environment_variables": sorted(env - SKIP_ENV),
    }
