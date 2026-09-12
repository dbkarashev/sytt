import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { fetchStories } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Redis.fromEnv() throws synchronously without env — keep it inside the async
// boundary so a missing config surfaces as "failed" instead of a crash.
async function pingRedis(): Promise<void> {
  await Redis.fromEnv().set("sytt:keepalive", new Date().toISOString());
}

// Hit by Vercel Cron once a day. Touches both free-tier stores so neither
// gets paused/archived for inactivity: Supabase (7 days) and Upstash (which
// otherwise only sees traffic on POST /api/stories).
export async function GET() {
  const [supabase, redis] = await Promise.allSettled([fetchStories(), pingRedis()]);
  if (supabase.status === "rejected") console.error("[keepalive] supabase", supabase.reason);
  if (redis.status === "rejected") console.error("[keepalive] redis", redis.reason);
  const ok = supabase.status === "fulfilled" && redis.status === "fulfilled";
  return NextResponse.json(
    {
      supabase: supabase.status === "fulfilled" ? "ok" : "failed",
      redis: redis.status === "fulfilled" ? "ok" : "failed",
    },
    { status: ok ? 200 : 500 },
  );
}
