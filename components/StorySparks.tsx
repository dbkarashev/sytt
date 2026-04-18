"use client";

import { useEffect, type RefObject } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { breathAmount } from "@/lib/breathing";
import type { Story } from "@/lib/types";

type Props = {
  globeRef: RefObject<GlobeMethods | undefined>;
  stories: Story[];
  me: { lat: number; lng: number } | null;
  mineIds: Set<string>;
  onSelect: (story: Story) => void;
  onAddHere: () => void;
};

function makeSparkTexture(THREE: typeof import("three")): InstanceType<typeof THREE.Texture> {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.2, "rgba(255, 235, 180, 1)");
  grad.addColorStop(0.45, "rgba(255, 190, 120, 0.55)");
  grad.addColorStop(0.75, "rgba(255, 140, 70, 0.18)");
  grad.addColorStop(1, "rgba(255, 120, 50, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function lodVisible(index: number, viewAltitude: number): boolean {
  if (viewAltitude < 2.2) return true;
  const ratio = Math.min(1, (6.5 - viewAltitude) / (6.5 - 2.2));
  const threshold = Math.round(1 / Math.max(0.3, ratio));
  return index % threshold === 0;
}

export default function StorySparks({
  globeRef,
  stories,
  me,
  mineIds,
  onSelect,
  onAddHere,
}: Props) {
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    let disposed = false;
    let raf = 0;
    const cleanups: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      const current = globeRef.current;
      if (!current) return;

      const scene = current.scene();
      const globeR = current.getGlobeRadius();
      const camera = current.camera();
      const renderer = current.renderer();

      const sparkTex = makeSparkTexture(THREE);
      cleanups.push(() => sparkTex.dispose());

      const group = new THREE.Group();
      group.renderOrder = 10;
      scene.add(group);
      cleanups.push(() => scene.remove(group));

      type SparkEntry = {
        story: Story;
        sprite: InstanceType<typeof THREE.Sprite>;
        material: InstanceType<typeof THREE.SpriteMaterial>;
        seed: number;
        warm: boolean;
        mine: boolean;
        baseScale: number;
        index: number;
      };

      const placeSprite = (
        sprite: InstanceType<typeof THREE.Sprite>,
        lat: number,
        lng: number,
        altitude = 0.8,
      ) => {
        const latR = (lat * Math.PI) / 180;
        const lngR = (lng * Math.PI) / 180;
        const r = globeR + altitude;
        const cosLat = Math.cos(latR);
        sprite.position.set(
          r * cosLat * Math.sin(lngR),
          r * Math.sin(latR),
          r * cosLat * Math.cos(lngR),
        );
      };

      const sparks: SparkEntry[] = stories.map((story, index) => {
        const warm = Boolean(story.coped);
        const mine = mineIds.has(story.id);
        const color = new THREE.Color(mine ? 0xfff0c0 : warm ? 0xffb060 : 0xff9050);
        const material = new THREE.SpriteMaterial({
          map: sparkTex,
          color,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(material);
        placeSprite(sprite, story.lat, story.lng, mine ? 2.0 : 0.8);
        const baseScale = mine ? 10 : warm ? 6.5 : 5.5;
        sprite.scale.setScalar(baseScale);
        sprite.center.set(0.5, 0.5);
        sprite.userData = { story };
        group.add(sprite);
        cleanups.push(() => {
          group.remove(sprite);
          material.dispose();
        });
        return { story, sprite, material, seed: Math.random() * 10, warm, mine, baseScale, index };
      });

      let preview:
        | {
            sprite: InstanceType<typeof THREE.Sprite>;
            material: InstanceType<typeof THREE.SpriteMaterial>;
            baseScale: number;
          }
        | null = null;

      if (me) {
        const previewMat = new THREE.SpriteMaterial({
          map: sparkTex,
          color: new THREE.Color(0xfff0c0),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: THREE.AdditiveBlending,
        });
        const previewSprite = new THREE.Sprite(previewMat);
        placeSprite(previewSprite, me.lat, me.lng, 3.5);
        const previewBase = 11;
        previewSprite.scale.setScalar(previewBase);
        previewSprite.center.set(0.5, 0.5);
        previewSprite.userData = { preview: true };
        group.add(previewSprite);
        cleanups.push(() => {
          group.remove(previewSprite);
          previewMat.dispose();
        });
        preview = { sprite: previewSprite, material: previewMat, baseScale: previewBase };
      }

      const tick = () => {
        if (disposed) return;
        const t = performance.now();
        const breath = breathAmount(t);
        const pov = current.pointOfView();
        const alt = pov.altitude;
        sparks.forEach((s) => {
          const visible = s.mine || lodVisible(s.index, alt);
          s.sprite.visible = visible;
          if (!visible) return;
          const tSec = t / 1000;
          const flicker =
            0.72 +
            0.18 * Math.sin(tSec * 3.1 + s.seed * 6.3) +
            0.1 * Math.sin(tSec * 7.7 + s.seed * 11.1);
          const pulse = s.mine ? 0.75 + 0.25 * breath : 0.85 + 0.15 * breath;
          s.material.opacity = Math.max(0, Math.min(1, flicker * pulse));
          const swing = s.mine ? 0.25 : 0.12;
          const scale = s.baseScale * (0.92 + swing * breath + 0.04 * (flicker - 0.8));
          s.sprite.scale.setScalar(scale);
        });
        if (preview) {
          preview.material.opacity = 0.55 + 0.45 * breath;
          preview.sprite.scale.setScalar(preview.baseScale * (0.88 + 0.4 * breath));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const ndc = new THREE.Vector2();
      const projected = new THREE.Vector3();
      const cameraPos = new THREE.Vector3();

      const handleClick = (ev: MouseEvent) => {
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

        camera.updateMatrixWorld(true);
        camera.getWorldPosition(cameraPos);
        const aspect = rect.width / rect.height;
        const pxThreshold = 18;
        const ndcTolX = (pxThreshold / rect.width) * 2;
        const ndcTolY = (pxThreshold / rect.height) * 2;

        const hitDistance = (pos: InstanceType<typeof THREE.Vector3>) => {
          const facing = pos.x * cameraPos.x + pos.y * cameraPos.y + pos.z * cameraPos.z;
          if (facing <= 0) return Infinity;
          projected.copy(pos).project(camera);
          if (projected.z < -1 || projected.z > 1) return Infinity;
          const dx = (projected.x - ndc.x) / ndcTolX;
          const dy = (projected.y - ndc.y) / ndcTolY;
          return dx * dx + dy * dy * aspect * aspect;
        };

        // Preview always wins if click lands on it.
        if (preview) {
          const d = hitDistance(preview.sprite.position);
          if (d < 1) {
            ev.stopPropagation();
            onAddHere();
            return;
          }
        }

        // Two passes: mine first (priority), then others.
        // Any hit on my own spark always wins over a neighbouring stranger.
        let bestMine: SparkEntry | null = null;
        let bestMineDist = 1;
        let bestOther: SparkEntry | null = null;
        let bestOtherDist = 1;
        for (const s of sparks) {
          if (!s.sprite.visible) continue;
          const d = hitDistance(s.sprite.position);
          if (d >= 1) continue;
          if (s.mine) {
            if (d < bestMineDist) {
              bestMineDist = d;
              bestMine = s;
            }
          } else if (d < bestOtherDist) {
            bestOtherDist = d;
            bestOther = s;
          }
        }
        const picked = bestMine ?? bestOther;
        if (picked) {
          ev.stopPropagation();
          onSelect(picked.story);
        }
      };

      const dom = renderer.domElement;
      dom.addEventListener("pointerdown", handleClick);
      cleanups.push(() => dom.removeEventListener("pointerdown", handleClick));
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
    };
  }, [globeRef, stories, me, mineIds, onSelect, onAddHere]);

  return null;
}
