"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import type { Story } from "@/lib/types";

type Props = {
  open: boolean;
  existing?: Story | null;
  onClose: () => void;
  onCreated: (story: Story) => void;
  onUpdated?: (story: Story) => void;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; reason: "rejected" | "rate_limited" | "forbidden" | "error" };

const FADE_MS = 500;

export default function AddStoryModal({
  open,
  existing,
  onClose,
  onCreated,
  onUpdated,
}: Props) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const [feeling, setFeeling] = useState("");
  const [coped, setCoped] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const isEdit = Boolean(existing);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSubmit({ status: "idle" });
      setText(existing?.text ?? "");
      setFeeling(existing?.feeling ?? "");
      setCoped(existing?.coped ?? "");
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(timeout);
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const textValid = text.trim().length >= 20 && text.trim().length <= 500;
  const feelingValid = feeling.length <= 300;
  const copedValid = coped.length <= 300;
  const canSubmit =
    submit.status !== "submitting" && textValid && feelingValid && copedValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textValid || !feelingValid || !copedValid) return;
    setSubmit({ status: "submitting" });
    try {
      const url = isEdit && existing ? `/api/stories/${existing.id}` : "/api/stories";
      const method = isEdit ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        text: text.trim(),
        feeling: feeling.trim() || null,
        lang: "en",
      };
      if (isEdit) payload.coped = coped.trim() || null;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        setSubmit({ status: "error", reason: "rate_limited" });
        return;
      }
      if (res.status === 403) {
        setSubmit({ status: "error", reason: "forbidden" });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmit({
          status: "error",
          reason: data?.reason === "rejected" ? "rejected" : "error",
        });
        return;
      }
      const data = (await res.json()) as { ok: boolean; story: Story };
      if (isEdit) {
        onUpdated?.(data.story);
      } else {
        onCreated(data.story);
      }
      setSubmit({ status: "success" });
      if (!isEdit) {
        setText("");
        setFeeling("");
        setCoped("");
      }
      setTimeout(() => onClose(), 1800);
    } catch {
      setSubmit({ status: "error", reason: "error" });
    }
  }

  const errorMessage =
    submit.status === "error"
      ? submit.reason === "rate_limited"
        ? t.form.rateLimited
        : submit.reason === "rejected"
          ? t.form.rejected
          : submit.reason === "forbidden"
            ? t.form.forbidden
            : t.form.error
      : null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[7000] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[78vh]"
        style={{
          background:
            "linear-gradient(to top, rgba(4,7,14,0.98) 0%, rgba(4,7,14,0.94) 40%, rgba(4,7,14,0.78) 65%, rgba(4,7,14,0.35) 88%, rgba(4,7,14,0) 100%)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative w-full max-w-xl px-6 pb-8 pt-6 sm:pb-10"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(14px)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="close"
          className="absolute right-5 top-4 text-lg text-[var(--color-ink-ghost)] transition-colors hover:text-[var(--color-ink)]"
        >
          ×
        </button>

        {submit.status === "success" ? (
          <p className="py-8 text-center font-serif text-[17px] italic text-[var(--color-warm-bright)]">
            {isEdit ? t.form.updateSuccess : t.form.success}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.form.textPlaceholder}
              maxLength={500}
              rows={3}
              autoFocus
              className="w-full resize-none border-0 border-b border-white/10 bg-transparent pb-2 font-serif text-[16px] leading-relaxed text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-ghost)]/80 focus:border-[var(--color-amber)]/60 focus:outline-none sm:text-[17px]"
            />

            <textarea
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder={t.form.feelingPlaceholder}
              maxLength={300}
              rows={2}
              className="w-full resize-none border-0 border-b border-white/5 bg-transparent pb-2 text-[14px] leading-relaxed text-[var(--color-ink-soft)] transition-colors placeholder:text-[var(--color-ink-ghost)]/70 focus:border-[var(--color-warm)]/40 focus:outline-none"
            />

            {isEdit && (
              <textarea
                value={coped}
                onChange={(e) => setCoped(e.target.value)}
                placeholder={t.form.copedPlaceholder}
                maxLength={300}
                rows={2}
                className="w-full resize-none border-0 border-b border-white/5 bg-transparent pb-2 text-[14px] leading-relaxed text-[var(--color-ink-soft)] transition-colors placeholder:text-[var(--color-ink-ghost)]/70 focus:border-[var(--color-warm)]/40 focus:outline-none"
              />
            )}

            {errorMessage && (
              <p className="text-[12px] italic text-[#e07a7a]">{errorMessage}</p>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`text-[12px] tracking-[0.22em] text-[var(--color-amber)] transition-colors hover:text-[var(--color-warm-bright)] disabled:cursor-not-allowed disabled:opacity-30 ${submit.status === "submitting" ? "animate-breathing" : ""}`}
              >
                {submit.status === "submitting"
                  ? t.form.submitting
                  : isEdit
                    ? `${t.form.save} →`
                    : `${t.form.submit} →`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
