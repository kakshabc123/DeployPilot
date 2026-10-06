"use client";
import { useRef, useState } from "react";
import { FolderOpen, Play } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const SKIP = ["node_modules/", ".git/", ".next/", ".venv/", "dist/", "build/", "__pycache__/"];

type Issue = { title: string; severity: string; description: string; evidence: string; suggested_fix: string };
type Analysis = {
  framework: string | null; language: string | null; package_manager: string | null;
  build_command: string | null; start_command: string | null; port: number | null; environment_variables: string[];
};

const sevColor: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-400/30", HIGH: "text-orange-400 border-orange-400/30",
  MEDIUM: "text-yellow-400 border-yellow-400/30", LOW: "text-blue-400 border-blue-400/30", INFO: "text-zinc-400 border-zinc-400/30",
};

async function readProject(list: FileList): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of Array.from(list)) {
    const path = f.webkitRelativePath.split("/").slice(1).join("/");
    if (!path || f.size > 200_000 || SKIP.some((s) => ("/" + path).includes("/" + s))) continue;
    try { out[path] = await f.text(); } catch { /* unreadable file */ }
  }
  return out;
}

export default function Dashboard() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setBusy(true); setError(null); setAnalysis(null); setLogs([]); setStatus(null);
    try {
      setName(e.target.files[0].webkitRelativePath.split("/")[0]);
      const res = await fetch(`${API}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: await readProject(e.target.files) }),
      });
      if (!res.ok) throw new Error(`Analyze failed (${res.status})`);
      const data = await res.json();
      setAnalysis(data.analysis); setIssues(data.issues); setEnv({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API. Is the backend running?");
    } finally { setBusy(false); }
  }

  async function deploy() {
    if (!analysis) return;
    setError(null); setLogs([]); setStatus("queued");
    try {
      const res = await fetch(`${API}/deployments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: name, branch: "local", build_command: analysis.build_command, start_command: analysis.start_command,
          required_env: analysis.environment_variables,
          env: Object.fromEntries(Object.entries(env).filter(([, v]) => v)),
        }),
      });
      if (!res.ok) throw new Error(`Deploy failed (${res.status})`);
      const { id } = await res.json();
      const es = new EventSource(`${API}/deployments/${id}/logs`);
      es.onmessage = (m) => setLogs((l) => [...l, m.data]);
      es.onerror = async () => {
        es.close();
        const s = await fetch(`${API}/deployments/${id}`).then((r) => r.json());
        setStatus(s.status);
      };
    } catch (err) {
      setStatus(null); setError(err instanceof Error ? err.message : "Deploy failed");
    }
  }

  const rows: [string, string | number | null][] = analysis ? [
    ["Framework", analysis.framework], ["Language", analysis.language], ["Package manager", analysis.package_manager],
    ["Build command", analysis.build_command], ["Start command", analysis.start_command], ["Port", analysis.port],
  ] : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{name || "New project"}</h1>
          <p className="text-xs text-zinc-500">Folders are read in your browser; only text files under 200 KB are sent to your local API.</p>
        </div>
        <button onClick={() => input.current?.click()} disabled={busy}
          className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50">
          <FolderOpen size={14} /> {busy ? "Analyzing..." : "Select project folder"}
        </button>
        <input ref={input} type="file" multiple className="hidden" onChange={onPick}
          {...({ webkitdirectory: "" } as Record<string, string>)} />
      </div>

      {error && <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error}</p>}
      {!analysis && !busy && !error && (
        <p className="py-24 text-center text-sm text-zinc-500">Select a project folder to analyze its framework, env vars and security baseline.</p>
      )}

      {analysis && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Detected</h2>
            <dl className="divide-y divide-white/10 rounded-lg border border-white/10 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2"><dt className="text-zinc-400">{k}</dt><dd className="font-mono">{v ?? "—"}</dd></div>
              ))}
            </dl>
            <h2 className="mb-2 mt-6 text-xs uppercase tracking-wider text-zinc-500">Environment variables</h2>
            {analysis.environment_variables.length === 0 && <p className="text-sm text-zinc-500">None detected.</p>}
            <div className="space-y-2">
              {analysis.environment_variables.map((v) => (
                <label key={v} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 truncate font-mono text-zinc-300">{v}</span>
                  <input type="password" autoComplete="off" placeholder="value (kept in memory only)" value={env[v] ?? ""}
                    onChange={(e) => setEnv({ ...env, [v]: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-white/30" />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Issues · Automated baseline security analysis</h2>
            {issues.length === 0 && <p className="text-sm text-zinc-500">No baseline issues found.</p>}
            <ul className="space-y-2">
              {issues.map((i, n) => (
                <li key={n} className="rounded-lg border border-white/10 p-3 text-sm">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${sevColor[i.severity] ?? ""}`}>{i.severity}</span>
                  <span className="ml-2 font-medium">{i.title}</span>
                  <p className="mt-1 text-zinc-400">{i.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">Fix: {i.suggested_fix}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-zinc-500">Deployment {status && `· ${status}`}</h2>
              <button onClick={deploy} disabled={status === "queued" || status === "building"}
                className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
                <Play size={14} /> Deploy (mock provider)
              </button>
            </div>
            <pre className="h-56 overflow-auto rounded-lg border border-white/10 bg-black p-3 font-mono text-xs leading-relaxed text-zinc-300">
              {logs.length ? logs.join("\n") : "Logs will stream here."}
            </pre>
            {status === "failed" && (
              <p className="mt-2 text-sm text-red-300">Deployment failed. Check the last log lines; AI diagnosis is not built yet.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
