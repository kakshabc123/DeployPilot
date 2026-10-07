import Link from "next/link";
import Image from "next/image";
import { Activity, ArrowUpRight, GitBranch, ShieldCheck } from "lucide-react";
import { VideoBackground } from "@/components/video-background";

const capabilities = [
  {
    icon: GitBranch,
    title: "Understand your repo",
    description:
      "Detect frameworks, build commands, ports, and required environment variables before you deploy.",
  },
  {
    icon: ShieldCheck,
    title: "Catch risks early",
    description:
      "Scan for committed environment files, exposed secrets, and common container security gaps.",
  },
  {
    icon: Activity,
    title: "Follow every release",
    description:
      "Watch deployment status and streamed build logs in one focused workspace.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-black text-white">
      <VideoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="DeployPilot home" className="flex items-center gap-3">
          <Image
            src="/deploypilot-logo.png"
            alt="DeployPilot"
            width={768}
            height={768}
            priority
            className="h-14 w-[190px] object-cover"
          />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-3 text-sm">
          <Link href="/login" className="px-3 py-2 text-white/75 hover:text-white">
            Log in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          >
            Create account <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[62vh] max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-12 text-center">
        <p className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium tracking-wide text-white/75">
          REPOSITORY ANALYSIS · SECURITY · DEPLOYMENT
        </p>
        <h1 className="mt-8 max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl">
          Ship with clarity.
          <br />
          <span className="font-heading font-normal italic text-white/75">Deploy with confidence.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
          DeployPilot reads your project, flags common security risks, and gives you a clear view of
          each deployment — from the first check to the final log.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Get started <ArrowUpRight size={17} />
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/20 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
          >
            Log in
          </Link>
        </div>
      </section>

      <section aria-label="DeployPilot features" className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, description }) => (
            <article key={title} className="liquid-glass min-h-52 rounded-2xl p-6">
              <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]">
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-medium tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-white/40">
          DeployPilot&apos;s current provider simulates deployments locally; it does not deploy to external infrastructure.
        </p>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-5 text-center text-xs text-white/40">
        DeployPilot · A clearer path from repository to release
      </footer>
    </main>
  );
}
