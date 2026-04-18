"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
const PAN_THRESHOLD_KM = 500;

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  const panResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const canNavigate = useMemo(
    () => stories.filter((s) => !mineIds.has(s.id)).length > 1,
    [stories, mineIds],
  );

  const projectStory = (s: Story) => {
    const g = globeRef.current;
    if (!g) return null;
    const cam = g.camera();
    cam.updateMatrixWorld(true);
    const r = g.getGlobeRadius() + 0.8;
    const latR = (s.lat * Math.PI) / 180;
    const lngR = (s.lng * Math.PI) / 180;
    const cosLat = Math.cos(latR);
    const v = new THREE.Vector3(
      r * cosLat * Math.sin(lngR),
      r * Math.sin(latR),
      r * cosLat * Math.cos(lngR),
    );
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    const facing = v.dot(camPos) > 0;
    const p = v.clone().project(cam);
    return { x: p.x, y: p.y, z: p.z, facing };
  };

  const navigateStory = (dir: -1 | 1) => {
    if (!selected) return;
    const cur = projectStory(selected);
    if (!cur || !cur.facing) return;

    type Cand = { s: Story; x: number; y: number };
    const candidates: Cand[] = [];
    for (const s of stories) {
      if (s.id === selected.id || mineIds.has(s.id)) continue;
      const p = projectStory(s);
      if (!p || !p.facing) continue;
      candidates.push({ s, x: p.x, y: p.y });
    }
    if (candidates.length === 0) return;

    const sameDir = candidates.filter((c) => (dir > 0 ? c.x > cur.x : c.x < cur.x));
    let chosen: Cand | null = null;
    if (sameDir.length > 0) {
      sameDir.sort((a, b) => {
        const sa = Math.abs(a.x - cur.x) + Math.abs(a.y - cur.y) * 0.8;
        const sb = Math.abs(b.x - cur.x) + Math.abs(b.y - cur.y) * 0.8;
        return sa - sb;
      });
      chosen = sameDir[0];
    } else {
      candidates.sort((a, b) => (dir > 0 ? a.x - b.x : b.x - a.x));
      chosen = candidates[0];
    }
    if (!chosen || chosen.s.id === selected.id) return;

    const dist = haversineKm(selected, chosen.s);
    setSelected(chosen.s);
    const g = globeRef.current;
    if (g && dist > PAN_THRESHOLD_KM) {
      const pov = g.pointOfView();
      const controls = g.controls();
      controls.autoRotate = false;
      g.pointOfView({ lat: chosen.s.lat, lng: chosen.s.lng, altitude: pov.altitude }, 1000);
      if (panResumeRef.current) clearTimeout(panResumeRef.current);
      panResumeRef.current = setTimeout(() => {
        controls.autoRotate = true;
      }, 5000);
    }
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
      <StoryOverlay
        story={selected}
        onClose={() => setSelected(null)}
        onPrev={canNavigate ? () => navigateStory(-1) : undefined}
        onNext={canNavigate ? () => navigateStory(1) : undefined}
      />

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
