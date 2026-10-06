'use client';

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";
const CAPABILITIES_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4";

const navLinks = ["Home", "Analysis", "Security", "Deployments", "Pricing"];

const cardData = [
  {
    icon: "image",
    title: "Repo Intelligence",
    description:
      "Detect frameworks, env requirements, build commands, and service startup patterns before a single deploy goes live.",
    tags: ["Auto Scan", "Framework Detect", "Env Audit", "Fast Setup"],
  },
  {
    icon: "movie",
    title: "Deploy Flow",
    description:
      "Coordinate build, rollout, and live monitoring in one place so your team can move from code to release with confidence.",
    tags: ["One Click", "Live Logs", "Status Sync", "Safe Rollouts"],
  },
  {
    icon: "lightbulb",
    title: "Security Baseline",
    description:
      "Catch leaked secrets, weak defaults, and risky runtime patterns before they turn into production breakage.",
    tags: ["Secret Scan", "Risk Checks", "Policy Guard", "Fix Guidance"],
  },
];

function FadingVideo({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const fadeTo = (target: number, duration: number) => {
      const startOpacity = Number.parseFloat(video.style.opacity || "0");
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentOpacity = startOpacity + (target - startOpacity) * progress;
        video.style.opacity = String(currentOpacity);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
        } else {
          animationFrameRef.current = null;
        }
      };

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    const handleLoadedData = () => {
      video.style.opacity = "0";
      video.play().catch(() => undefined);
      fadeTo(1, 500);
    };

    const handleTimeUpdate = () => {
      const duration = video.duration || 0;
      const current = video.currentTime || 0;
      if (!fadingOutRef.current && duration > 0 && duration - current <= 0.55 && duration - current > 0) {
        fadingOutRef.current = true;
        fadeTo(0, 500);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      window.setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => undefined);
        fadingOutRef.current = false;
        fadeTo(1, 500);
      }, 100);
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
      src={src}
    />
  );
}

function BlurText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const words = text.split(" ");

  return (
    <p
      ref={ref}
      className="flex max-w-2xl flex-wrap justify-center gap-x-[0.28em] leading-[0.8]"
      style={{ rowGap: "0.1em" }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          animate={
            visible
              ? { filter: ["blur(10px)", "blur(5px)", "blur(0px)"], opacity: [0, 0.5, 1], y: [50, -5, 0] }
              : { filter: "blur(10px)", opacity: 0, y: 50 }
          }
          transition={{ duration: 0.7, delay: index * 0.1, ease: "easeOut", times: [0, 0.5, 1] }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

function Icon({ type }: { type: "image" | "movie" | "lightbulb" | "clock" | "globe" | "arrow-up-right" | "play" }) {
  const common = "h-6 w-6 text-white";

  if (type === "image") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden="true">
        <path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21H5Zm1-4h12l-3.75-5-3 4L9 13l-3 4Z" />
      </svg>
    );
  }

  if (type === "movie") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden="true">
        <path d="M4 6.47 5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.89-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4Z" />
      </svg>
    );
  }

  if (type === "lightbulb") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden="true">
        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7Z" />
      </svg>
    );
  }

  if (type === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "globe") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "arrow-up-right") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M6 4h14v14L12 8l-6 10V4Z" />
    </svg>
  );
}

export default function Landing() {
  return (
    <main className="bg-black text-white">
      <section className="relative min-h-screen overflow-hidden bg-black">
        <FadingVideo
          src={HERO_VIDEO}
          className="absolute left-1/2 top-0 z-0 -translate-x-1/2 object-cover object-top"
          style={{ width: "120%", height: "120%" }}
        />

        <div className="relative z-10 flex min-h-screen flex-col">
          <nav className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-[1400px] -translate-x-1/2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full liquid-glass border border-white/10 text-white">
                <span className="font-heading text-[1.5rem] leading-none italic">DP</span>
              </div>

              <div className="hidden items-center gap-2 rounded-full liquid-glass px-1.5 py-1.5 md:flex">
                {navLinks.map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="rounded-full px-3 py-2 text-sm font-medium text-white/90 font-body hover:bg-white/5"
                  >
                    {item}
                  </a>
                ))}
                <Link href="/dashboard" className="ml-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black whitespace-nowrap">
                  Open Console
                </Link>
              </div>

              <div className="h-12 w-12" aria-hidden="true" />
            </div>
          </nav>

          <div className="flex flex-1 items-center justify-center px-4 pt-24">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                className="liquid-glass flex items-center gap-2 rounded-full px-2 py-1.5"
              >
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black">
                  New
                </span>
                <span className="pr-3 text-sm text-white/90">AI deployment workflows for modern engineering teams</span>
              </motion.div>

              <motion.div
                initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
                className="mt-6"
              >
                <BlurText text="Ship Production Changes Without the Guesswork" />
              </motion.div>

              <motion.p
                initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
                className="mt-4 max-w-2xl text-sm text-white/90 md:text-base font-body font-light leading-tight"
              >
                DeployPilot analyzes your repository, surfaces security risks, and keeps deployment logs visible from
                first push to final release — all in one streamlined workflow.
              </motion.p>

              <motion.div
                initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.1, ease: "easeOut" }}
                className="mt-6 flex items-center gap-6"
              >
                <Link href="/dashboard" className="liquid-glass-strong flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white">
                  Launch Console <Icon type="arrow-up-right" />
                </Link>
                <a href="#capabilities" className="flex items-center gap-2 text-sm font-medium text-white/90">
                  See how it works <Icon type="play" />
                </a>
              </motion.div>

              <motion.div
                initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.3, ease: "easeOut" }}
                className="mt-8 flex flex-col items-stretch gap-4 md:flex-row"
              >
                <div className="liquid-glass w-[220px] rounded-[1.25rem] p-5 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5">
                    <Icon type="clock" />
                  </div>
                  <div className="mt-5 font-heading text-4xl tracking-[-1px] text-white leading-none">2.4x</div>
                  <div className="mt-2 text-xs font-light text-white/80">Faster release cycles</div>
                </div>
                <div className="liquid-glass w-[220px] rounded-[1.25rem] p-5 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5">
                    <Icon type="globe" />
                  </div>
                  <div className="mt-5 font-heading text-4xl tracking-[-1px] text-white leading-none">24/7</div>
                  <div className="mt-2 text-xs font-light text-white/80">Live deployment visibility</div>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4, ease: "easeOut" }}
            className="flex flex-col items-center gap-4 pb-8"
          >
            <div className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white">
              Built for shipping teams that want fewer surprises and faster recovery
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-2xl tracking-tight text-white md:gap-12 md:text-3xl">
              {['Deploy', 'Diagnose', 'Secure', 'Monitor', 'Ship'].map((name) => (
                <span key={name} className="font-heading italic">{name}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="capabilities" className="relative min-h-screen overflow-hidden bg-black">
        <FadingVideo src={CAPABILITIES_VIDEO} className="absolute inset-0 z-0 h-full w-full object-cover" />

        <div className="relative z-10 flex min-h-screen flex-col px-8 pb-10 pt-24 md:px-16 lg:px-20">
          <div className="mb-auto">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-6 text-sm text-white/80"
            >
              // Capabilities
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="font-heading text-6xl leading-[0.9] tracking-[-3px] text-white md:text-7xl lg:text-[6rem]"
            >
              Production<br />evolved
            </motion.h2>

            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {cardData.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                  className="liquid-glass flex min-h-[360px] flex-col rounded-[1.25rem] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[0.75rem] liquid-glass">
                      <Icon type={card.icon as "image" | "movie" | "lightbulb"} />
                    </div>
                    <div className="flex max-w-[70%] flex-wrap justify-end gap-1.5">
                      {card.tags.map((tag) => (
                        <span key={tag} className="liquid-glass rounded-full px-3 py-1 text-[11px] text-white/90 whitespace-nowrap">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex-1">
                    <h3 className="font-heading text-3xl leading-none tracking-[-1px] text-white md:text-4xl">{card.title}</h3>
                    <p className="mt-3 max-w-[32ch] text-sm leading-snug text-white/90 font-body font-light">{card.description}</p>
                  </div>

                  <div className="mt-6 flex items-center gap-3 text-white">
                    <div className="flex h-6 w-6 items-center justify-center">
                      <Icon type="arrow-up-right" />
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center">
                      <Icon type="play" />
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
