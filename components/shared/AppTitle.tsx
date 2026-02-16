"use client";

import Link from "next/link";

const SUNO_LOGO_URL = "https://www.suno.com/favicon.ico";

type AppTitleProps = {
  /** Smaller variant for header; default is larger for page hero */
  variant?: "hero" | "header";
  className?: string;
};

/** Shared gradient for title and sign-in button. */
export const TITLE_GRADIENT =
  "linear-gradient(to right, #22d3ee, #22c55e, #3b82f6, #8b5cf6, #d946ef, #ec4899, #eab308, #ef4444)";

export function AppTitle({ variant = "hero", className = "" }: AppTitleProps) {
  const isHeader = variant === "header";
  return (
    <h1
      className={
        isHeader
          ? `text-xl font-bold tracking-tight bg-clip-text text-transparent ${className}`.trim()
          : `text-3xl font-bold tracking-tight sm:text-4xl bg-clip-text text-transparent ${className}`.trim()
      }
      style={{ backgroundImage: TITLE_GRADIENT }}
    >
      Suno Music Studio
    </h1>
  );
}

type AppTitleWithLogoProps = {
  className?: string;
  titleClassName?: string;
  /** When set, the whole title links here (e.g. "/"); logo becomes non-clickable to avoid nested anchors */
  href?: string;
};

/** Logo + "Suno Music Studio" title; same block for signed-in and signed-out views. */
export function AppTitleWithLogo({ className = "", titleClassName = "", href }: AppTitleWithLogoProps) {
  const content = (
    <>
      <span className="flex shrink-0" aria-hidden>
        <img src={SUNO_LOGO_URL} alt="" className="h-10 w-10" width={40} height={40} />
      </span>
      <AppTitle className={titleClassName} />
    </>
  );

  const wrapperClass = `flex flex-wrap items-center justify-center gap-3 text-center ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={`focus:outline-none rounded-lg ${wrapperClass}`.trim()}>
        {content}
      </Link>
    );
  }

  return (
    <div className={wrapperClass}>
      <a
        href="https://www.suno.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0"
        aria-label="Suno"
      >
        <img src={SUNO_LOGO_URL} alt="" className="h-10 w-10" width={40} height={40} />
      </a>
      <AppTitle className={titleClassName} />
    </div>
  );
}
