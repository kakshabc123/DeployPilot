"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Check,
  Circle,
  CloudUpload,
  FileCode2,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { VideoBackground } from "@/components/video-background";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const DASHBOARD_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4";
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".venv", "dist", "build", "__pycache__"]);
const MAX_FILE_BYTES = 5_000_000;
const MAX_PROJECT_BYTES = 25_000_000;
const MAX_PROJECT_FILES = 5_000;
const TEXT_EXTENSIONS = new Set([
  ".c", ".cjs", ".conf", ".cpp", ".cs", ".css", ".dart", ".env", ".example", ".go", ".gradle",
  ".h", ".html", ".ini", ".java", ".js", ".json", ".jsx", ".kt", ".lock", ".md", ".mjs",
  ".php", ".properties", ".py", ".rb", ".rs", ".scala", ".scss", ".sh", ".sql", ".swift",
  ".toml", ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
]);
const TERMINAL_STATUSES = new Set(["live", "failed", "canceled"]);

type Issue = {
  title: string;
  severity: string;
  description: string;
  evidence: string;
  suggested_fix: string;
};
type ReadinessCheck = {
  key: string;
  title: string;
  status: "ready" | "attention" | "not_detected";
  detail: string;
  recommendation: string | null;
};
type Analysis = {
  framework: string | null;
  language: string | null;
  package_manager: string | null;
  build_command: string | null;
  start_command: string | null;
  port: number | null;
  runtime_version: string | null;
  has_dockerfile: boolean;
  has_ci: boolean;
  environment_variables: string[];
  stats: {
    files_analyzed: number;
    source_files: number;
    source_lines: number;
    declared_dependencies: number | null;
  };
  checks: ReadinessCheck[];
};
type ProjectFiles = {
  files: Record<string, string>;
  skippedLarge: number;
  skippedBudget: number;
  skippedCount: number;
  skippedBinary: number;
  unreadable: number;
};
type UploadStats = Omit<ProjectFiles, "files"> & { included: number };

const severityStyle: Record<string, string> = {
  CRITICAL: "border-red-300/25 bg-red-400/10 text-red-200",
  HIGH: "border-orange-300/25 bg-orange-400/10 text-orange-200",
  MEDIUM: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  LOW: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  INFO: "border-white/15 bg-white/5 text-white/70",
};

async function readProject(list: FileList): Promise<ProjectFiles> {
  const files: Record<string, string> = {};
  let skippedLarge = 0;
  let skippedBudget = 0;
  let skippedCount = 0;
  let skippedBinary = 0;
  let unreadable = 0;
  let totalBytes = 0;

  for (const file of Array.from(list)) {
    const path = file.webkitRelativePath.split("/").slice(1).join("/") || file.name;
    if (!path || path.split("/").some((part) => SKIP_DIRS.has(part.toLowerCase()))) continue;
    if (file.size > MAX_FILE_BYTES) {
      skippedLarge += 1;
      continue;
    }
    if (Object.keys(files).length >= MAX_PROJECT_FILES) {
      skippedCount += 1;
      continue;
    }
    if (totalBytes + file.size > MAX_PROJECT_BYTES) {
      skippedBudget += 1;
      continue;
    }

    const baseName = path.split("/").pop() ?? path;
    const extensionStart = baseName.lastIndexOf(".");
    const extension = extensionStart >= 0 ? baseName.slice(extensionStart).toLowerCase() : "";
    const isKnownText = TEXT_EXTENSIONS.has(extension) ||
      ["Dockerfile", "Makefile", ".gitignore", ".dockerignore"].includes(baseName);
    if (!file.type.startsWith("text/") && file.type !== "application/json" &&
      !isKnownText && !baseName.startsWith(".env")) {
      skippedBinary += 1;
      continue;
    }

    try {
      files[path] = await file.text();
      totalBytes += file.size;
    } catch {
      unreadable += 1;
    }
  }

  return { files, skippedLarge, skippedBudget, skippedCount, skippedBinary, unreadable };
}

function WorkflowStep({
  title,
  detail,
  complete,
  active,
  attention = false,
}: {
  title: string;
  detail: string;
  complete: boolean;
  active: boolean;
  attention?: boolean;
}) {
  const Icon = complete ? Check : attention ? AlertTriangle : active ? LoaderCircle : Circle;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        complete
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
          : attention
            ? "border-amber-200/25 bg-amber-100/[0.06] text-amber-100"
          : active
            ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
            : "border-white/15 bg-white/[0.03] text-white/30"
      }`}>
        <Icon size={14} className={active && !complete ? "animate-spin" : ""} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/90">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/45">{detail}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const input = useRef<HTMLInputElement>(null);
  const logsSource = useRef<EventSource | null>(null);
  const terminalStatus = useRef(false);
  const [busy, setBusy] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logWarning, setLogWarning] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);

  useEffect(() => () => logsSource.current?.close(), []);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;

    logsSource.current?.close();
    logsSource.current = null;
    terminalStatus.current = false;
    setBusy(true);
    setError(null);
    setLogWarning(null);
    setAnalysis(null);
    setIssues([]);
    setLogs([]);
    setStatus(null);
    setDeploymentId(null);
    setDeploying(false);
    setUploadStats(null);
    setName(selectedFiles[0].webkitRelativePath.split("/")[0] || "Uploaded project");

    try {
      const uploaded = await readProject(selectedFiles);
      setUploadStats({
        included: Object.keys(uploaded.files).length,
        skippedLarge: uploaded.skippedLarge,
        skippedBudget: uploaded.skippedBudget,
        skippedCount: uploaded.skippedCount,
        skippedBinary: uploaded.skippedBinary,
        unreadable: uploaded.unreadable,
      });
      if (Object.keys(uploaded.files).length === 0) {
        throw new Error("No readable project files found. Choose a folder containing text source or configuration files.");
      }

      const response = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded.files }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Analysis failed (${response.status})`);
      }
      const result = await response.json();
      setAnalysis(result.analysis);
      setIssues(result.issues);
      setEnv({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the analysis API.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function deploy() {
    if (!analysis || deploying) return;
    setError(null);
    setLogWarning(null);
    setLogs([]);
    setStatus("queued");
    setDeploying(true);
    terminalStatus.current = false;

    try {
      const response = await fetch(`${API}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: name,
          branch: "local",
          build_command: analysis.build_command,
          start_command: analysis.start_command,
          required_env: analysis.environment_variables,
          env: Object.fromEntries(Object.entries(env).filter(([, value]) => value)),
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Simulation failed (${response.status})`);
      }

      const { id } = await response.json();
      setDeploymentId(id);
      const eventSource = new EventSource(`${API}/deployments/${id}/logs`);
      logsSource.current = eventSource;
      eventSource.onmessage = (message) => setLogs((current) => [...current, message.data]);
      eventSource.onerror = () => {
        eventSource.close();
        if (!terminalStatus.current) {
          setLogWarning("Live logs disconnected. The simulator will continue checking status.");
        }
      };

      while (true) {
        const statusResponse = await fetch(`${API}/deployments/${id}`);
        if (!statusResponse.ok) {
          const detail = await statusResponse.text();
          throw new Error(detail || `Could not check simulation status (${statusResponse.status})`);
        }
        const result: { status: string } = await statusResponse.json();
        setStatus(result.status);
        if (TERMINAL_STATUSES.has(result.status)) {
          terminalStatus.current = true;
          setLogWarning(null);
          eventSource.close();
          logsSource.current = null;
          setDeploying(false);
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    } catch (err) {
      logsSource.current?.close();
      logsSource.current = null;
      setDeploying(false);
      setError(err instanceof Error ? err.message : "Simulation failed.");
    }
  }

  async function cancelDeployment() {
    if (!deploymentId) return;
    setError(null);
    try {
      const response = await fetch(`${API}/deployments/${deploymentId}/cancel`, { method: "POST" });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Cancel failed (${response.status})`);
      }
      const result: { status: string } = await response.json();
      setStatus(result.status);
      if (TERMINAL_STATUSES.has(result.status)) terminalStatus.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel simulation.");
    }
  }

  const missingEnv = analysis?.environment_variables.filter((key) => !env[key]?.trim()) ?? [];
  const readyToConfigure = missingEnv.length === 0;
  const steps = [
    {
      title: "Upload project",
      detail: analysis ? `${analysis.stats.files_analyzed} readable files received` : "Choose a local project folder",
      complete: Boolean(analysis),
      active: busy,
    },
    {
      title: "Analyze & inspect",
      detail: analysis ? "Repository facts and baseline checks are ready" : "Waiting for project files",
      complete: Boolean(analysis),
      active: busy,
    },
    {
      title: "Configure",
      detail: !analysis ? "Waiting for analysis" : missingEnv.length ? `${missingEnv.length} required values missing` : "Required values are set",
      complete: Boolean(analysis && readyToConfigure),
      active: false,
      attention: Boolean(analysis && !readyToConfigure),
    },
    {
      title: "Deployment simulation",
      detail: status ? `Simulator: ${status}` : "No cloud deployment is connected",
      complete: status === "live",
      active: deploying,
    },
  ];
  const metadataRows: [string, string | number | null][] = analysis ? [
    ["Framework", analysis.framework],
    ["Language", analysis.language],
    ["Package manager", analysis.package_manager],
    ["Build command", analysis.build_command],
    ["Start command", analysis.start_command],
    ["Application port", analysis.port],
    ["Node runtime", analysis.runtime_version],
  ] : [];

  return (
    <div className="relative min-h-screen text-white">
      <VideoBackground src={DASHBOARD_VIDEO} />
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-14 sm:px-8">
        <header className="flex min-h-[76px] items-center justify-between border-b border-white/10">
          <a href="/" className="flex items-center gap-2.5" aria-label="DeployPilot home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08]">
              <Activity size={17} />
            </span>
            <span className="text-sm font-semibold tracking-wide">DeployPilot</span>
            <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/45 sm:inline">
              Workspace
            </span>
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={() => input.current?.click()}
              disabled={busy || deploying}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50 sm:text-sm"
            >
              <FolderOpen size={15} />
              {busy ? "Analyzing project…" : "Upload project"}
            </button>
            <SignOutButton />
          </div>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={onPick}
            {...({ webkitdirectory: "" } as Record<string, string>)}
          />
        </header>

        <section className="py-9 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/70">
                Repository intelligence
              </p>
              <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
                {name || "Your project, release-ready"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Upload your project to inspect its actual files, deployment configuration, and baseline security findings.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-amber-100/15 bg-amber-100/[0.06] px-3 py-1.5 text-[11px] text-amber-50/75">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
              Deployments are simulated · no cloud provider connected
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}

          <section aria-label="Project workflow" className="liquid-glass-strong mt-7 rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
              <Activity size={14} /> Workflow
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => <WorkflowStep key={step.title} {...step} />)}
            </div>
          </section>
        </section>

        {!analysis && !busy && (
          <section className="liquid-glass-strong flex min-h-[320px] flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-sky-100">
              <CloudUpload size={25} strokeWidth={1.5} />
            </span>
            <h2 className="mt-5 text-xl font-medium">Start with your project files</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
              Choose the full extracted project folder. DeployPilot reads its source and configuration files in your browser, then reports findings from those files.
            </p>
            <button
              onClick={() => input.current?.click()}
              className="mt-6 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-50"
            >
              <FolderOpen size={16} /> Select project folder
            </button>
            <p className="mt-4 text-[11px] text-white/35">
              Up to 5,000 files / 25 MB total · files over 5 MB and dependency/build folders are excluded
            </p>
          </section>
        )}

        {busy && (
          <div role="status" className="liquid-glass-strong flex min-h-[240px] flex-col items-center justify-center rounded-2xl">
            <LoaderCircle className="animate-spin text-sky-100" size={27} />
            <p className="mt-4 text-sm text-white/75">Reading and analyzing uploaded files…</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-5">
            <section aria-label="Measured repository insights" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Files analyzed", value: analysis.stats.files_analyzed, note: "Text/config files in this upload", icon: FolderOpen },
                { label: "Source files", value: analysis.stats.source_files, note: "Recognized source extensions", icon: FileCode2 },
                { label: "Non-empty source lines", value: analysis.stats.source_lines.toLocaleString(), note: "Counted from uploaded source", icon: Activity },
                {
                  label: "Declared packages",
                  value: analysis.stats.declared_dependencies ?? "—",
                  note: analysis.stats.declared_dependencies === null
                    ? "No valid package.json to count"
                    : "dependencies + devDependencies in package.json",
                  icon: Boxes,
                },
              ].map(({ label, value, note, icon: Icon }) => (
                <article key={label} className="liquid-glass rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-white/55">{label}</p>
                      <p className="mt-2 text-3xl font-medium tracking-tight">{value}</p>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-sky-100/75">
                      <Icon size={17} />
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-white/40">{note}</p>
                </article>
              ))}
            </section>

            {uploadStats && (
              <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-relaxed text-white/55">
                Upload scope: {analysis.stats.files_analyzed} of {uploadStats.included} selected project files analyzed.
                {uploadStats.skippedLarge > 0 && ` ${uploadStats.skippedLarge} files over 5 MB skipped.`}
                {uploadStats.skippedBudget > 0 && ` ${uploadStats.skippedBudget} files skipped to stay within the 25 MB total upload limit.`}
                {uploadStats.skippedCount > 0 && ` ${uploadStats.skippedCount} files skipped after the 5,000-file limit.`}
                {uploadStats.skippedBinary > 0 && ` · ${uploadStats.skippedBinary} binary files skipped`}
                {uploadStats.unreadable > 0 && ` · ${uploadStats.unreadable} unreadable files skipped`}.
                Dependency/build output folders are intentionally excluded; findings apply only to analyzed files.
              </p>
            )}

            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="liquid-glass-strong rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <GitBranch size={16} className="text-sky-100" /> Project profile
                    </div>
                    <p className="mt-1 text-xs text-white/45">Detected directly from the uploaded repository files</p>
                  </div>
                  {analysis.framework && (
                    <span className="rounded-full border border-sky-100/15 bg-sky-100/[0.06] px-3 py-1 text-xs text-sky-50/80">
                      {analysis.framework}
                    </span>
                  )}
                </div>
                {!analysis.framework && (
                  <p className="mt-4 rounded-lg border border-amber-200/15 bg-amber-100/[0.05] p-3 text-sm text-amber-50/75">
                    No supported framework was detected in these files. Confirm the project manifest is included.
                  </p>
                )}
                <dl className="mt-5 divide-y divide-white/[0.08]">
                  {metadataRows.map(([label, value]) => (
                    <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                      <dt className="text-white/50">{label}</dt>
                      <dd className="break-all text-right font-mono text-xs text-white/85">{value ?? "Not detected"}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <dt className="text-white/50">Required environment variables</dt>
                    <dd className="text-white/85">{analysis.environment_variables.length} detected</dd>
                  </div>
                </dl>
                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    <Activity size={14} /> Deployment checks
                  </h3>
                  <ul className="space-y-2">
                    {analysis.checks.map((check) => (
                      <li key={check.key} className="flex items-start gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 p-3">
                        {check.status === "ready"
                          ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-200" />
                          : check.status === "attention"
                            ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-200" />
                            : <Circle size={14} className="mt-0.5 shrink-0 text-white/35" />}
                        <div>
                          <p className="text-xs font-medium text-white/85">{check.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-white/50">{check.detail}</p>
                          {check.recommendation && <p className="mt-1 text-xs leading-relaxed text-amber-100/70">{check.recommendation}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="liquid-glass-strong rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck size={16} className="text-emerald-100" /> Repository findings
                    </div>
                    <p className="mt-1 text-xs text-white/45">Automated baseline security checks · uploaded files only</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/50">
                    {issues.length} {issues.length === 1 ? "finding" : "findings"}
                  </span>
                </div>
                {issues.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-emerald-200/10 bg-emerald-100/[0.04] p-4">
                    <p className="flex items-center gap-2 text-sm text-emerald-50/80">
                      <Check size={15} /> No matches in the baseline checks
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-white/45">
                      This is not a full security audit. Only listed rules were checked against the files you uploaded.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {issues.map((issue, index) => (
                      <li key={`${issue.title}-${issue.evidence}-${index}`} className="rounded-xl border border-white/10 bg-black/15 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                            severityStyle[issue.severity] ?? severityStyle.INFO
                          }`}>{issue.severity}</span>
                          <h3 className="text-sm font-medium text-white/90">{issue.title}</h3>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-white/60">{issue.description}</p>
                        <p className="mt-2 break-all font-mono text-[11px] text-white/45">Evidence: {issue.evidence}</p>
                        <p className="mt-2 text-xs leading-relaxed text-sky-50/70">Suggested action: {issue.suggested_fix}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="liquid-glass-strong rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity size={16} className="text-sky-100" /> Deployment workflow
                    {status && (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/65">
                        simulator · {status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">
                    The current provider simulates build and release steps locally. It does not execute your code or create cloud resources.
                  </p>
                  {deploymentId && <p className="mt-2 font-mono text-[10px] text-white/30">Run ID: {deploymentId}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {deploying && (
                    <button
                      onClick={cancelDeployment}
                      className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 transition hover:bg-white/[0.06]"
                    >
                      <X size={14} /> Cancel
                    </button>
                  )}
                  <button
                    onClick={deploy}
                    disabled={deploying || busy || missingEnv.length > 0}
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Play size={14} /> {deploying ? "Simulating…" : "Run simulation"}
                  </button>
                </div>
              </div>

              {missingEnv.length > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-100/15 bg-amber-100/[0.05] p-3 text-xs leading-relaxed text-amber-50/70">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  Fill the detected environment variable values below to run the simulation.                   Values are sent to the configured API for this run and are not written to logs.
                </div>
              )}

              {analysis.environment_variables.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {analysis.environment_variables.map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 block truncate font-mono text-[11px] text-white/65">{key}</span>
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder="Sent for this run · never logged"
                        value={env[key] ?? ""}
                        onChange={(event) => setEnv((current) => ({ ...current, [key]: event.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-sky-100/40"
                      />
                    </label>
                  ))}
                </div>
              )}

              <pre className="mt-5 h-52 overflow-auto rounded-xl border border-white/10 bg-[#02070c]/75 p-4 font-mono text-xs leading-relaxed text-white/75">
                {logs.length ? logs.join("\n") : "Simulation output will appear here."}
              </pre>
              {logWarning && <p className="mt-2 text-xs text-amber-100/80">{logWarning}</p>}
              {status === "failed" && (
                <p className="mt-3 text-sm text-red-200">The simulated build failed. Review the output and required environment variable names.</p>
              )}
              {status === "canceled" && <p className="mt-3 text-sm text-white/55">Simulation canceled.</p>}
              {status === "live" && (
                <p className="mt-3 text-sm text-emerald-100/80">Simulation completed. No cloud deployment was created.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
