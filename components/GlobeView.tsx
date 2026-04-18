"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { useLang } from "@/lib/i18n";
import AddStoryModal from "./AddStoryModal";
import BreathIndicator from "./BreathIndicator";
import BreathingCore from "./BreathingCore";
import GlobeSkeleton from "./GlobeSkeleton";
import StorySparks from "./StorySparks";
import StoryOverlay from "./StoryOverlay";
import type { Story } from "@/lib/types";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-night-0)]">
      <span className="font-serif text-xs italic text-[var(--color-ink-ghost)]">…</span>
    </div>
  ),
});

type Coords = { lat: number; lng: number };

const MINE_KEY = "save.mine";

function readMine(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MINE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeMine(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MINE_KEY, JSON.stringify([...ids]));
}

export default function GlobeView() {
  const { t } = useLang();
  const [stories, setStories] = useState<Story[]>([]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Story | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [me, setMe] = useState<Coords | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  useEffect(() => {
    setMineIds(readMine());
    let alive = true;
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data?.stories)) setStories(data.stories);
      })
      .catch(() => {});
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        if (typeof data.lat === "number" && typeof data.lng === "number") {
          setMe({ lat: data.lat, lng: data.lng });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleCreated = (story: Story) => {
    setStories((prev) => [story, ...prev]);
    setMineIds((prev) => {
      const next = new Set(prev);
      next.add(story.id);
      writeMine(next);
      return next;
    });
  };

  const handleUpdated = (story: Story) => {
    setStories((prev) => prev.map((s) => (s.id === story.id ? story : s)));
  };

  const handleSparkClick = (story: Story) => {
    if (mineIds.has(story.id)) {
      setEditing(story);
      setModalOpen(true);
      return;
    }
    setSelected(story);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const hasOwnSparkHere =
    me !== null &&
    stories.some(
      (s) => mineIds.has(s.id) && Math.abs(s.lat - me.lat) < 0.3 && Math.abs(s.lng - me.lng) < 0.3,
    );
  const previewCoords = !hasOwnSparkHere ? me : null;
  // Rings pulse around "your spot" whenever we know where you are — even if
  // you already have a spark there (so you never lose sight of yourself).
  const rings = me ? [me] : [];

  const focusMe = () => {
    if (!me) return;
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    g.pointOfView({ lat: me.lat, lng: me.lng, altitude: 1.6 }, 1400);
    setTimeout(() => {
      controls.autoRotate = true;
    }, 6000);
  };

  return (
    <div className="relative h-full w-full">
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-[900ms]"
        style={{ opacity: ready ? 0 : 1, pointerEvents: "none" }}
      >
        <GlobeSkeleton />
      </div>
      <div
        className="absolute inset-0 transition-opacity duration-[1100ms]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Globe ref={globeRef} onReady={() => setReady(true)} rings={rings} />
      </div>
      {ready && <BreathingCore globeRef={globeRef} />}
      {ready && (
        <StorySparks
          globeRef={globeRef}
          stories={stories}
          me={previewCoords}
          mineIds={mineIds}
          onSelect={handleSparkClick}
          onAddHere={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
      )}
      <StoryOverlay story={selected} onClose={() => setSelected(null)} />

      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[500] flex flex-col items-center gap-3">
        {!previewCoords && !hasOwnSparkHere && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            aria-label={t.map.tellStory}
            className="pointer-events-auto group flex flex-col items-center gap-2"
          >
            <span
              aria-hidden
              className="block h-3 w-3 rounded-full bg-[#ffb060] shadow-[0_0_14px_rgba(255,176,96,0.65),0_0_28px_rgba(224,112,48,0.35)] transition-transform group-hover:scale-125"
              style={{ animation: "breathing 11s ease-in-out infinite" }}
            />
            <span className="font-serif text-[11px] italic tracking-wide text-[var(--color-ink-ghost)] transition-colors group-hover:text-[var(--color-ink-soft)]">
              {t.map.tellStory}
            </span>
          </button>
        )}
        <BreathIndicator />
      </div>

      {me && (
        <button
          type="button"
          onClick={focusMe}
          aria-label="find me"
          className="pointer-events-auto absolute bottom-6 right-6 z-[600] flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(15,26,43,0.7)] text-[var(--color-ink-soft)] backdrop-blur-md transition-colors hover:border-[rgba(201,147,90,0.7)] hover:text-[var(--color-warm-bright)]"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M12 2v3M12 19v3M2 12h3M19 12h3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      <AddStoryModal
        open={modalOpen}
        existing={editing}
        onClose={closeModal}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
