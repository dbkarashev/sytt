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
        <span className="flex items-center gap-2 font-serif text-[11px] tracking-[0.04em] text-[var(--color-ink-ghost)]">
          made by
          <a
            href="https://dbkarashev.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="dbkarashev.com"
            className="pointer-events-auto inline-flex items-center opacity-80 transition-opacity hover:opacity-100"
          >
            <img src="/dbkarashev.svg" alt="dbkarashev" className="h-6 w-auto" />
          </a>
        </span>
      </header>
      <ManifestoOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
