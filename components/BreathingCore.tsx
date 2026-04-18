"use client";

import { useEffect, type RefObject } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { breathAmount } from "@/lib/breathing";

type Props = {
  globeRef: RefObject<GlobeMethods | undefined>;
};

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fireFragment = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  uniform float uTime;
  uniform float uBreath;
  uniform float uScale;
  uniform float uAlpha;

  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float fbm(vec3 p){
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++){
      v += a * snoise(p);
      p *= 2.0; a *= 0.5;
    }
    return v;
  }

  void main(){
    vec3 p = normalize(vPos);
    float t = uTime * 0.25;
    float n = fbm(p * uScale + vec3(0.0, t, -t * 0.6));
    n = 0.5 + 0.5 * n;
    n = smoothstep(0.25, 0.95, n);

    vec3 core   = vec3(0.95, 0.68, 0.32);
    vec3 middle = vec3(0.78, 0.38, 0.15);
    vec3 halo   = vec3(0.40, 0.10, 0.04);

    vec3 col = mix(halo, middle, smoothstep(0.20, 0.55, n));
    col = mix(col, core, smoothstep(0.60, 0.92, n));

    float breath = 0.55 + 0.45 * uBreath;
    float alpha = pow(n, 1.6) * uAlpha * breath;
    gl_FragColor = vec4(col * breath, alpha);
  }
`;

const particleVertex = /* glsl */ `
  attribute float aBirth;
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uBreath;
  uniform float uGlobeR;
  varying float vAge;
  varying float vAlpha;

  void main(){
    float life = 2.5 + aSeed.z * 2.5;
    float t = mod(uTime - aBirth, life) / life;
    vAge = t;

    // start radius past fire core, end radius reaches into mantle
    float r0 = uGlobeR * 0.12;
    float r1 = uGlobeR * 0.32;
    float r = mix(r0, r1, t);

    vec3 dir = normalize(aSeed * 2.0 - 1.0);
    vec3 pos = dir * r;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    float breath = 0.4 + 0.6 * uBreath;
    float fade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.7, 1.0, t));
    vAlpha = fade * breath * 0.08;

    gl_PointSize = mix(2.8, 0.8, t) * (220.0 / max(1.0, -gl_Position.z));
  }
`;

const particleFragment = /* glsl */ `
  precision highp float;
  varying float vAge;
  varying float vAlpha;

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    vec3 hot  = vec3(1.0, 0.9, 0.55);
    vec3 cool = vec3(0.9, 0.4, 0.15);
    vec3 col = mix(hot, cool, vAge);

    float edge = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(col, edge * vAlpha);
  }
`;

export default function BreathingCore({ globeRef }: Props) {
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

      const fireShells = [
        { radius: globeR * 0.17, scale: 2.4, alpha: 0.3 },
        { radius: globeR * 0.1, scale: 3.8, alpha: 0.55 },
      ].map(({ radius, scale, alpha }) => {
        const geom = new THREE.SphereGeometry(radius, 64, 64);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uBreath: { value: 0 },
            uScale: { value: scale },
            uAlpha: { value: alpha },
          },
          vertexShader,
          fragmentShader: fireFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          side: THREE.FrontSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        cleanups.push(() => {
          scene.remove(mesh);
          geom.dispose();
          mat.dispose();
        });
        return { mesh, mat };
      });

      const N = 45;
      const positions = new Float32Array(N * 3);
      const births = new Float32Array(N);
      const seeds = new Float32Array(N * 3);
      const now = performance.now() / 1000;
      for (let i = 0; i < N; i++) {
        births[i] = now - Math.random() * 5;
        seeds[i * 3] = Math.random();
        seeds[i * 3 + 1] = Math.random();
        seeds[i * 3 + 2] = Math.random();
      }
      const pGeom = new THREE.BufferGeometry();
      pGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      pGeom.setAttribute("aBirth", new THREE.BufferAttribute(births, 1));
      pGeom.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));

      const pMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBreath: { value: 0 },
          uGlobeR: { value: globeR },
        },
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const particles = new THREE.Points(pGeom, pMat);
      scene.add(particles);
      cleanups.push(() => {
        scene.remove(particles);
        pGeom.dispose();
        pMat.dispose();
      });

      const start = performance.now();
      const tick = () => {
        if (disposed) return;
        const ms = performance.now();
        const t = (ms - start) / 1000;
        const breath = breathAmount(ms);
        fireShells.forEach(({ mat }) => {
          (mat.uniforms.uTime.value as number) = t;
          (mat.uniforms.uBreath.value as number) = breath;
        });
        (pMat.uniforms.uTime.value as number) = t;
        (pMat.uniforms.uBreath.value as number) = breath;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
    };
  }, [globeRef]);

  return null;
}
