"use client";

const STROKE = "rgba(107, 138, 158, 0.5)";
const R = 40;

export default function GlobeSkeleton() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg viewBox="-50 -50 100 100" className="h-[72px] w-[72px]" aria-hidden>
        {/* outer sphere silhouette */}
        <circle cx="0" cy="0" r={R} fill="none" stroke={STROKE} strokeWidth="1.2" />
        {/* equator + parallels (static, horizontal) */}
        <line x1={-R} y1="0" x2={R} y2="0" stroke={STROKE} strokeWidth="0.9" />
        <ellipse
          cx="0"
          cy={-R * 0.55}
          rx={R * Math.cos(Math.asin(0.55))}
          ry={R * 0.08}
          fill="none"
          stroke={STROKE}
          strokeWidth="0.7"
        />
        <ellipse
          cx="0"
          cy={R * 0.55}
          rx={R * Math.cos(Math.asin(0.55))}
          ry={R * 0.08}
          fill="none"
          stroke={STROKE}
          strokeWidth="0.7"
        />

        {/* meridians rotating around vertical axis */}
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx="0"
            cy="0"
            rx={R}
            ry={R}
            fill="none"
            stroke={STROKE}
            strokeWidth="0.9"
          >
            <animate
              attributeName="rx"
              values={`${R};0;${R}`}
              keyTimes="0;0.5;1"
              dur="2.4s"
              begin={`${-i * 0.6}s`}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}
      </svg>
    </div>
  );
}
