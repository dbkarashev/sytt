import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 60 * 60 * 1000;
const MAX = 3;

type Checker = (ipHash: string) => Promise<boolean>;

function hasUpstashEnv(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  );
}

function createUpstashChecker(): Checker {
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(MAX, "1 h"),
    analytics: true,
    prefix: "sytt:rl",
  });
  return async (ipHash) => {
    const { success } = await limiter.limit(ipHash);
    return !success;
  };
}

function createMemoryChecker(): Checker {
  const store = new Map<string, number[]>();
  return async (ipHash) => {
    const now = Date.now();
    const recent = (store.get(ipHash) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    store.set(ipHash, recent);
    return recent.length > MAX;
  };
}

let checker: Checker | null = null;
let resolved = false;

function resolveChecker(): Checker | null {
  if (resolved) return checker;
  resolved = true;
  if (hasUpstashEnv()) {
    checker = createUpstashChecker();
  } else if (process.env.NODE_ENV !== "production") {
    checker = createMemoryChecker();
  } else {
    console.error("[ratelimit] prod without Upstash env — failing closed");
    checker = null;
  }
  return checker;
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  const check = resolveChecker();
  if (!check) return true;
  try {
    return await check(ipHash);
  } catch (err) {
    console.error("[ratelimit] check failed", err);
    return process.env.NODE_ENV === "production";
  }
}
