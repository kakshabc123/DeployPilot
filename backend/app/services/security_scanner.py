from __future__ import annotations
import re
from typing import Any

BASELINE_LABEL = "Automated baseline security analysis"  # not enterprise-grade scanning
SECRETS = {
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "GitHub token": re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "OpenAI-style key": re.compile(r"sk-[A-Za-z0-9]{32,}"),
}


def _issue(title: str, sev: str, desc: str, evidence: str, fix: str, auto: bool = False) -> dict[str, Any]:
    return {"title": title, "severity": sev, "description": desc, "evidence": evidence,
            "suggested_fix": fix, "auto_fix_possible": auto, "source": "scanner"}


def scan(files: dict[str, str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for path, text in files.items():
        name = path.rsplit("/", 1)[-1]
        if name.startswith(".env") and name not in (".env.example", ".env.sample", ".env.template"):
            out.append(_issue("Committed environment file", "CRITICAL",
                              f"{path} is tracked in the repository and may contain secrets.", path,
                              "Remove it from git history, rotate its secrets, add it to .gitignore."))
        for label, rx in SECRETS.items():
            if rx.search(text):
                out.append(_issue(f"Possible {label} in source", "CRITICAL",
                                  "A string matching a known secret pattern was found.",
                                  f"{path} (value redacted)", "Revoke and rotate the credential; load from env vars."))
        if name == "Dockerfile" or name.startswith("Dockerfile."):
            if not re.search(r"^\s*USER\s+(?!root\b)\S+", text, re.M | re.I):
                out.append(_issue("Container runs as root", "HIGH",
                                  "No non-root USER instruction in Dockerfile.", path,
                                  "Add `RUN adduser --disabled-password app` and `USER app`.", True))
            if re.search(r"^\s*FROM\s+\S+:latest\b", text, re.M | re.I):
                out.append(_issue("Unpinned base image", "MEDIUM", "FROM uses the :latest tag.", path,
                                  "Pin a specific version tag or digest.", True))
    if ".gitignore" in files and ".env" not in files[".gitignore"]:
        out.append(_issue(".env not in .gitignore", "MEDIUM", "Env files may be committed by accident.",
                          ".gitignore", "Add `.env*` (except .env.example) to .gitignore.", True))
    return out
