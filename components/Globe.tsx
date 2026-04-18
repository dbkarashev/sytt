"use client";

import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from "h3-js";

type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

type Props = {
  onReady?: () => void;
  rings?: { lat: number; lng: number }[];
};

const AUTO_ROTATE_RESUME_MS = 5000;

const Globe = forwardRef<GlobeMethods | undefined, Props>(function Globe({ onReady, rings = [] }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [land, setLand] = useState<Feature[]>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/countries.geojson")
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((data) => {
        if (alive) setLand(data.features);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const methodsRef = useRef<GlobeMethods | undefined>(undefined);

  useEffect(() => {
    const methods = methodsRef.current;
    if (typeof ref === "function") ref(methods);
    else if (ref) ref.current = methods;
  });

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x0a1322,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    [],
  );

  const antarcticaGeom = useMemo(() => {
    const ant = land.find((f) => {
      const p = f.properties as { NAME?: string };
      return p.NAME === "Antarctica";
    });
    if (!ant) return null;
    const geom = ant.geometry as {
      type: "MultiPolygon" | "Polygon";
      coordinates: number[][][] | number[][][][];
    };
    const polys =
      geom.type === "MultiPolygon"
        ? (geom.coordinates as number[][][][])
        : [(geom.coordinates as number[][][])];
    return polys.map((poly) => poly[0]);
  }, [land]);

  const pointInRing = (lat: number, lng: number, ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect =
        yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const antarcticaCells = useMemo(() => {
    if (!antarcticaGeom) return [];
    const H3_RES = 4;
    const poleCell = latLngToCell(-89.9, 0, H3_RES);
    const cells = gridDisk(poleCell, 95);
    const out: { lat: number; lng: number; boundary: [number, number][] }[] = [];
    for (const idx of cells) {
      const [lat, lng] = cellToLatLng(idx);
      if (lat >= -60) continue;
      let hit = lat < -72;
      if (!hit) {
        for (const ring of antarcticaGeom) {
          if (pointInRing(lat, lng, ring)) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        const boundary = cellToBoundary(idx);
        out.push({ lat, lng, boundary });
      }
    }
    return out;
  }, [antarcticaGeom]);

  const hexLand = useMemo(
    () =>
      land.filter((f) => {
        const p = f.properties as { NAME?: string };
        return p.NAME !== "Antarctica";
      }),
    [land],
  );

  const dotMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: 0x6b8a9e, side: THREE.DoubleSide }),
    [],
  );

  const buildDot = (d: object) => {
    const MARGIN = 0.3;
    const { lat, lng, boundary } = d as {
      lat: number;
      lng: number;
      boundary: [number, number][];
    };
    const r = 100.5;
    const toVec = (la: number, ln: number) => {
      const latR = (la * Math.PI) / 180;
      const lngR = (ln * Math.PI) / 180;
      const cosLat = Math.cos(latR);
      return new THREE.Vector3(
        r * cosLat * Math.sin(lngR),
        r * Math.sin(latR),
        r * cosLat * Math.cos(lngR),
      );
    };
    const center = toVec(lat, lng);
    const edge = toVec(boundary[0][0], boundary[0][1]);
    const radius = 0.85 * (1 - MARGIN) * center.distanceTo(edge);
    const geom = new THREE.CircleGeometry(radius, 3);
    const mesh = new THREE.Mesh(geom, dotMaterial);
    mesh.position.copy(center);
    mesh.lookAt(0, 0, 0);
    mesh.rotateY(Math.PI);
    return mesh;
  };

  const handleReady = () => {
    const g = methodsRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 620;

    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    });
    controls.addEventListener("end", () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        controls.autoRotate = true;
      }, AUTO_ROTATE_RESUME_MS);
    });

    g.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);
    onReady?.();
  };

  return (
    <div ref={wrapRef} className="h-full w-full">
      {size.w > 0 && size.h > 0 && (
        <GlobeGL
          ref={methodsRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          showGlobe
          showAtmosphere={false}
          showGraticules
          globeMaterial={globeMaterial}
          hexPolygonsData={hexLand}
          hexPolygonGeoJsonGeometry={(d: object) => (d as Feature).geometry as { type: string; coordinates: number[] }}
          hexPolygonResolution={4}
          hexPolygonMargin={0.3}
          hexPolygonUseDots
          hexPolygonDotResolution={3}
          hexPolygonColor={() => "#6b8a9e"}
          customLayerData={antarcticaCells}
          customThreeObject={buildDot}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t: number) => `rgba(255, 176, 96, ${(1 - t) * 0.9})`}
          ringMaxRadius={7}
          ringPropagationSpeed={2.2}
          ringRepeatPeriod={1600}
          ringAltitude={0.02}
          ringResolution={96}
          onGlobeReady={handleReady}
        />
      )}
    </div>
  );
});

export default Globe;
