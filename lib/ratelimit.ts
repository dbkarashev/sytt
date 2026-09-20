import { hitRateLimit, supabaseLive } from "./supabase";

const WINDOW_SECONDS = 60 * 60;
const MAX = 3;

type Checker = (ipHash: string) => Promise<boolean>;

// Prod: one RPC into Postgres (rate_limit_hit in supabase-setup.sql) that
// counts and records the attempt atomically, before moderation runs.
function createSupabaseChecker(): Checker {
  return (ipHash) => hitRateLimit(ipHash, MAX, WINDOW_SECONDS);
}

function createMemoryChecker(): Checker {
  const store = new Map<string, number[]>();
  return async (ipHash) => {
    const now = Date.now();
    const recent = (store.get(ipHash) ?? []).filter((t) => now - t < WINDOW_SECONDS * 1000);
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
  if (supabaseLive) {
    checker = createSupabaseChecker();
  } else if (process.env.NODE_ENV !== "production") {
    checker = createMemoryChecker();
  } else {
    console.error("[ratelimit] prod without Supabase env — failing closed");
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
