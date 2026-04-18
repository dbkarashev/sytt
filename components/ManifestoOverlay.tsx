"use client";

import { useEffect, useState } from "react";
import { messages } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

const FADE_MS = 650;

export default function ManifestoOverlay({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const t = messages.manifesto;

  return (
    <div
      className="fixed inset-0 z-[8000] flex items-center justify-center overflow-hidden px-6 py-10"
      style={{
        backgroundColor: visible ? "rgba(3,6,12,0.85)" : "rgba(3,6,12,0)",
        backdropFilter: visible ? "blur(10px)" : "blur(0px)",
        WebkitBackdropFilter: visible ? "blur(10px)" : "blur(0px)",
        transition: `background-color ${FADE_MS}ms ease, backdrop-filter ${FADE_MS}ms ease`,
      }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute right-5 top-5 text-2xl text-[var(--color-ink-ghost)] transition-colors hover:text-[var(--color-ink)]"
      >
        ×
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl text-left"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(10px)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }}
      >
        <div
          className="space-y-5 font-serif text-[var(--color-ink-soft)]"
          style={{ fontSize: "clamp(14px, 2.1vh, 18px)", lineHeight: 1.7 }}
        >
          {t.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <figure
          className="mt-12 text-center"
          style={{ fontSize: "clamp(13px, 2vh, 18px)" }}
        >
          <blockquote className="font-serif italic leading-[1.6] text-[var(--color-ink)]">
            “{t.quote}”
          </blockquote>
          <figcaption className="mt-4 text-[10px] tracking-[0.18em] text-[var(--color-ink-ghost)]">
            — {t.quoteSource}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
