"use client";

import { useState } from "react";
import ManifestoOverlay from "./ManifestoOverlay";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex items-center justify-between px-5 py-4 md:px-7 md:py-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto font-serif text-[14px] tracking-[0.04em] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
        >
          save yourself this time
        </button>
        <a
          href="https://dbkarashev.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="made by Damir Karashev"
          className="pointer-events-auto flex items-center gap-2 font-serif text-[11px] italic tracking-[0.04em] text-[var(--color-ink-ghost)] transition-colors hover:text-[var(--color-ink-soft)]"
        >
          <span>made by</span>
          <svg
            viewBox="0 0 22 14"
            aria-hidden
            shapeRendering="crispEdges"
            className="h-4 w-auto"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="3" y="0" width="1" height="1" />
            <rect x="2" y="1" width="1" height="2" />
            <rect x="1" y="3" width="1" height="1" />
            <rect x="0" y="4" width="6" height="2" />
            <rect x="0" y="6" width="2" height="2" />
            <rect x="4" y="6" width="2" height="2" />
            <rect x="0" y="8" width="6" height="4" />
            <rect x="18" y="0" width="1" height="1" />
            <rect x="19" y="1" width="1" height="2" />
            <rect x="20" y="3" width="1" height="1" />
            <rect x="16" y="4" width="6" height="2" />
            <rect x="16" y="6" width="2" height="2" />
            <rect x="20" y="6" width="2" height="2" />
            <rect x="16" y="8" width="6" height="4" />
          </svg>
        </a>
      </header>
      <ManifestoOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
