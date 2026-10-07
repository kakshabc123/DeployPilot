"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VideoBackground } from "@/components/video-background";

type AuthFormProps = {
  mode: "login" | "signup";
  configured: boolean;
  nextPath: string;
  setupRequired: boolean;
  callbackError: boolean;
};

export function AuthForm({ mode, configured, nextPath, setupRequired, callbackError }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!configured) {
      setError("Supabase is not configured. Add the project URL and anon key to frontend/.env.local, then restart the frontend.");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", nextPath);
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback.toString() },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Check your email for a confirmation link to finish creating your account.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5 py-12 text-white">
      <VideoBackground />
      <header className="absolute left-0 right-0 top-0 z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex" aria-label="DeployPilot home">
          <Image
            src="/deploypilot-logo.png"
            alt="DeployPilot"
            width={768}
            height={768}
            priority
            className="h-14 w-[185px] object-cover"
          />
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm text-white/75 hover:text-white">
          <ArrowLeft size={15} /> Back home
        </Link>
      </header>

      <section className="relative z-10 my-16 w-full max-w-[460px] rounded-[1.75rem] border border-white/20 bg-[#06101a]/65 p-7 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-10">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-sky-100/70">
          {isSignup ? "Start your journey" : "Your workspace awaits"}
        </p>
        <h1 className="font-heading text-4xl italic tracking-tight sm:text-5xl">
          {isSignup ? "Make room to ship." : "Good to see you."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          {isSignup
            ? "Create your DeployPilot account and bring your next release into focus."
            : "Log in to pick up where your team left off."}
        </p>

        {callbackError && (
          <p role="alert" className="mt-5 rounded-xl border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">
            That confirmation link is invalid or expired. Log in or request a new signup confirmation.
          </p>
        )}

        {(setupRequired || !configured) && (
          <div className="mt-6 rounded-xl border border-amber-200/25 bg-amber-200/10 p-3 text-sm text-amber-50/90">
            Set up Supabase to access the dashboard. Add{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono text-xs">frontend/.env.local</code>, then restart Next.js.
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm text-white/85">
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3.5 text-white outline-none placeholder:text-white/40 focus:border-sky-100/60 focus:ring-2 focus:ring-sky-100/10"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm text-white/85">
            Password
            <input
              type="password"
              name="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3.5 text-white outline-none placeholder:text-white/40 focus:border-sky-100/60 focus:ring-2 focus:ring-sky-100/10"
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
            />
          </label>
          {isSignup && (
            <label className="block text-sm text-white/85">
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3.5 text-white outline-none placeholder:text-white/40 focus:border-sky-100/60 focus:ring-2 focus:ring-sky-100/10"
                placeholder="Enter your password again"
              />
            </label>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-200/25 bg-emerald-200/10 p-3 text-sm text-emerald-50">{message}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/[0.94] px-4 py-3.5 font-medium text-[#09111a] shadow-lg shadow-black/15 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Please wait..." : isSignup ? "Create account" : "Log in"}
            {!busy && <ArrowUpRight size={17} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/65">
          {isSignup ? "Already have an account?" : "New to DeployPilot?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
