"use client";

import { useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/types";

type Props = {
  story: Story | null;
  onClose: () => void;
};

const FADE_MS = 500;
const BASE_DELAY = 32;
const SECTION_PAUSE = 650;

function charDelay(ch: string): number {
  if (ch === "," || ch === ";" || ch === ":") return BASE_DELAY + 130;
  if (ch === "." || ch === "!" || ch === "?") return BASE_DELAY + 280;
  if (ch === "—" || ch === "–") return BASE_DELAY + 180;
  if (ch === "\n") return BASE_DELAY + 200;
  if (ch === " ") return BASE_DELAY + 14;
  return BASE_DELAY;
}

export default function StoryOverlay({ story, onClose }: Props) {
  const [rendered, setRendered] = useState<Story | null>(null);
  const [visible, setVisible] = useState(false);
  const [shownText, setShownText] = useState(0);
  const [shownFeeling, setShownFeeling] = useState(0);
  const [shownCoped, setShownCoped] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = rendered?.text.toLocaleLowerCase() ?? "";
  const feeling = rendered?.feeling?.toLocaleLowerCase() ?? "";
  const coped = rendered?.coped?.toLocaleLowerCase() ?? "";

  useEffect(() => {
    if (story) {
      setRendered(story);
      setShownText(0);
      setShownFeeling(0);
      setShownCoped(0);
      setRevealed(false);
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const to = setTimeout(() => setRendered(null), FADE_MS);
    return () => clearTimeout(to);
  }, [story]);

  useEffect(() => {
    if (!rendered) return;
    if (revealed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShownText(text.length);
      setShownFeeling(feeling.length);
      setShownCoped(coped.length);
      return;
    }
    let cancelled = false;
    let i = 0;
    let j = 0;
    let k = 0;

    const scheduleText = () => {
      if (cancelled) return;
      if (i >= text.length) {
        if (feeling) {
          timerRef.current = setTimeout(scheduleFeeling, SECTION_PAUSE);
        } else if (coped) {
          timerRef.current = setTimeout(scheduleCoped, SECTION_PAUSE);
        }
        return;
      }
      const ch = text[i];
      i++;
      setShownText(i);
      timerRef.current = setTimeout(scheduleText, charDelay(ch));
    };

    const scheduleFeeling = () => {
      if (cancelled) return;
      if (j >= feeling.length) {
        if (coped) timerRef.current = setTimeout(scheduleCoped, SECTION_PAUSE);
        return;
      }
      const ch = feeling[j];
      j++;
      setShownFeeling(j);
      timerRef.current = setTimeout(scheduleFeeling, charDelay(ch));
    };

    const scheduleCoped = () => {
      if (cancelled) return;
      if (k >= coped.length) return;
      const ch = coped[k];
      k++;
      setShownCoped(k);
      timerRef.current = setTimeout(scheduleCoped, charDelay(ch));
    };

    const initial = setTimeout(scheduleText, FADE_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rendered, text, feeling, coped, revealed]);

  useEffect(() => {
    if (!rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rendered, onClose]);

  if (!rendered) return null;

  const hasFeeling = Boolean(feeling);
  const hasCoped = Boolean(coped);
  const textDone = shownText >= text.length;
  const feelingDone = !hasFeeling || shownFeeling >= feeling.length;
  const copedDone = !hasCoped || shownCoped >= coped.length;
  const fullyShown = textDone && feelingDone && copedDone;

  const handleContentClick = () => {
    if (!fullyShown) setRevealed(true);
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[7500] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[75vh]"
        style={{
          background:
            "linear-gradient(to top, rgba(7,11,20,0.94) 0%, rgba(7,11,20,0.78) 40%, rgba(7,11,20,0.35) 78%, rgba(7,11,20,0) 100%)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />

      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="pointer-events-auto absolute right-5 top-5 z-10 text-xl text-[var(--color-ink-ghost)] transition-colors hover:text-[var(--color-ink)]"
      >
        ×
      </button>

      <div
        className={`pointer-events-auto relative w-full max-w-2xl px-6 pb-10 pt-8 sm:pb-12 ${
          !fullyShown ? "cursor-pointer" : ""
        }`}
        onClick={(e) => {
          if (!fullyShown) {
            e.stopPropagation();
            handleContentClick();
          }
        }}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }}
      >
        <p className="font-serif text-[17px] leading-[1.65] text-[var(--color-ink)] sm:text-[19px]">
          {text.slice(0, shownText)}
          {!textDone && (
            <span className="animate-cursor ml-0.5 text-[var(--color-warm-bright)]/80">▍</span>
          )}
        </p>

        {hasFeeling && textDone && (
          <p className="mt-5 font-serif text-[15px] leading-[1.65] text-[var(--color-ink-soft)] sm:text-[16px]">
            {feeling.slice(0, shownFeeling)}
            {!feelingDone && (
              <span className="animate-cursor ml-0.5 text-[var(--color-warm-bright)]/70">▍</span>
            )}
          </p>
        )}

        {hasCoped && feelingDone && textDone && (
          <>
            <div
              className="my-9 flex justify-center text-[var(--color-warm-bright)]/40"
              aria-hidden
            >
              <span className="text-[13px] leading-none">✦</span>
            </div>
            <p className="font-serif text-[15px] leading-[1.65] text-[var(--color-ink-soft)] sm:text-[16px]">
              {coped.slice(0, shownCoped)}
              {!copedDone && (
                <span className="animate-cursor ml-0.5 text-[var(--color-warm-bright)]/70">▍</span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
