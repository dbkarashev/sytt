export const BREATH = {
  inhaleMs: 4000,
  holdMs: 1000,
  exhaleMs: 6000,
} as const;

export const BREATH_TOTAL = BREATH.inhaleMs + BREATH.holdMs + BREATH.exhaleMs;

export type BreathPhase = "inhale" | "hold" | "exhale";

export function breathPhase(t: number): BreathPhase {
  const ms = ((t % BREATH_TOTAL) + BREATH_TOTAL) % BREATH_TOTAL;
  if (ms < BREATH.inhaleMs) return "inhale";
  if (ms < BREATH.inhaleMs + BREATH.holdMs) return "hold";
  return "exhale";
}

export function breathAmount(t: number): number {
  const ms = ((t % BREATH_TOTAL) + BREATH_TOTAL) % BREATH_TOTAL;
  if (ms < BREATH.inhaleMs) {
    return easeInOut(ms / BREATH.inhaleMs);
  }
  if (ms < BREATH.inhaleMs + BREATH.holdMs) {
    return 1;
  }
  return 1 - easeInOut((ms - BREATH.inhaleMs - BREATH.holdMs) / BREATH.exhaleMs);
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}
