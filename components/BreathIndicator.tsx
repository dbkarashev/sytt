"use client";

import { useEffect, useRef } from "react";
import { BREATH, BREATH_TOTAL, breathAmount } from "@/lib/breathing";
import { useLang } from "@/lib/i18n";

const FADE_IN_MS = 1500;
const FADE_OUT_MS = 900;

export default function BreathIndicator() {
  const { t } = useLang();
  const inhaleRef = useRef<HTMLSpanElement>(null);
  const exhaleRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ms = performance.now();
      const cycle = ((ms % BREATH_TOTAL) + BREATH_TOTAL) % BREATH_TOTAL;

      let inhaleOp = 0;
      let exhaleOp = 0;

      if (cycle < BREATH.inhaleMs) {
        inhaleOp = Math.min(1, cycle / FADE_IN_MS);
      } else if (cycle < BREATH.inhaleMs + BREATH.holdMs) {
        inhaleOp = Math.max(0, 1 - (cycle - BREATH.inhaleMs) / BREATH.holdMs);
      } else {
        const et = cycle - (BREATH.inhaleMs + BREATH.holdMs);
        if (et < FADE_IN_MS) exhaleOp = et / FADE_IN_MS;
        else if (et < BREATH.exhaleMs - FADE_OUT_MS) exhaleOp = 1;
        else exhaleOp = Math.max(0, 1 - (et - (BREATH.exhaleMs - FADE_OUT_MS)) / FADE_OUT_MS);
      }

      const amount = breathAmount(ms);
      const scale = 1 + 0.04 * amount;
      const letterSpacing = 0.18 + 0.06 * amount;

      if (inhaleRef.current) inhaleRef.current.style.opacity = String(0.55 * inhaleOp);
      if (exhaleRef.current) exhaleRef.current.style.opacity = String(0.55 * exhaleOp);
      if (wrapRef.current) {
        wrapRef.current.style.transform = `scale(${scale})`;
        wrapRef.current.style.letterSpacing = `${letterSpacing.toFixed(3)}em`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="relative flex h-5 w-24 items-center justify-end font-serif text-[11px] text-[var(--color-ink-ghost)] will-change-transform"
    >
      <span ref={inhaleRef} className="absolute" style={{ opacity: 0 }}>
        {t.map.breatheIn}
      </span>
      <span ref={exhaleRef} className="absolute" style={{ opacity: 0 }}>
        {t.map.breatheOut}
      </span>
    </div>
  );
}
