from __future__ import annotations
import json, re
from typing import Any

ENV_RE = [re.compile(r"process\.env\.([A-Z][A-Z0-9_]+)"),
          re.compile(r"os\.environ(?:\.get)?[\[(]\s*['\"]([A-Z][A-Z0-9_]+)"),
          re.compile(r"os\.getenv\(\s*['\"]([A-Z][A-Z0-9_]+)")]
SRC_EXT = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".py")
SOURCE_EXT = SRC_EXT + (".cjs", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs", ".cpp", ".c", ".h")
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
    package_json_valid = None
    if "package.json" in files:
        try:
            parsed = json.loads(files["package.json"])
            package_json_valid = isinstance(parsed, dict)
            if package_json_valid:
                pkg = parsed
        except json.JSONDecodeError:
            package_json_valid = False
    dependencies = pkg.get("dependencies")
    if not isinstance(dependencies, dict):
        dependencies = {}
    dev_dependencies = pkg.get("devDependencies")
    if not isinstance(dev_dependencies, dict):
        dev_dependencies = {}
    deps = {**dependencies, **dev_dependencies}
    py = (files.get("requirements.txt", "") + files.get("pyproject.toml", "")).lower()
    scripts = pkg.get("scripts", {})
    if not isinstance(scripts, dict):
        scripts = {}
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
    engines = pkg.get("engines")
    if not isinstance(engines, dict):
        engines = {}

    env: set[str] = set()
    for path, text in files.items():
        if path.endswith(SRC_EXT):
            for rx in ENV_RE:
                env.update(rx.findall(text))
    for line in files.get(".env.example", "").splitlines():
        m = re.match(r"\s*([A-Z][A-Z0-9_]*)\s*=", line)
        if m:
            env.add(m.group(1))

    source_files = [(path, text) for path, text in files.items() if path.lower().endswith(SOURCE_EXT)]
    stats = {
        "files_analyzed": len(files),
        "source_files": len(source_files),
        "source_lines": sum(
            1 for _, text in source_files for line in text.splitlines() if line.strip()
        ),
        "declared_dependencies": len(deps) if "package.json" in files and package_json_valid else None,
    }

    checks = [
        {
            "key": "build",
            "title": "Build command",
            "status": "ready" if build else "attention",
            "detail": f"Detected `{build}` from package.json." if build else
                      "No build script was detected in the uploaded project files.",
            "recommendation": None if build else
                              "Add a build script to package.json or provide a build command for your platform.",
        },
        {
            "key": "ci",
            "title": "CI workflow",
            "status": "ready" if any(p.startswith(".github/workflows/") for p in files) else "attention",
            "detail": "A GitHub Actions workflow file was found." if any(
                p.startswith(".github/workflows/") for p in files
            ) else "No GitHub Actions workflow file was found in the uploaded files.",
            "recommendation": None if any(p.startswith(".github/workflows/") for p in files) else
                              "Add a CI workflow to run checks before releases.",
        },
        {
            "key": "container",
            "title": "Container recipe",
            "status": "ready" if any(
                path.rsplit("/", 1)[-1].lower().startswith("dockerfile") for path in files
            ) else "not_detected",
            "detail": "A Dockerfile was found." if any(
                path.rsplit("/", 1)[-1].lower().startswith("dockerfile") for path in files
            ) else "No Dockerfile was found; this is optional for many hosting platforms.",
            "recommendation": None,
        },
        {
            "key": "manifest",
            "title": "Project manifest",
            "status": "attention" if package_json_valid is False else "ready" if pkg or py else "not_detected",
            "detail": "package.json could not be parsed as a JSON object." if package_json_valid is False else
                      "A supported Node.js or Python project manifest was found." if pkg or py else
                      "No supported Node.js or Python manifest was detected in the uploaded files.",
            "recommendation": "Fix package.json syntax before relying on detected scripts and dependencies."
            if package_json_valid is False else None,
        },
    ]

    return {
        "framework": fw, "language": lang, "package_manager": pm,
        "build_command": build, "start_command": start, "port": port,
        "runtime_version": engines.get("node"),
        "has_dockerfile": "Dockerfile" in files,
        "has_ci": any(p.startswith(".github/workflows/") for p in files),
        "environment_variables": sorted(env - SKIP_ENV),
        "stats": stats,
        "checks": checks,
    }
