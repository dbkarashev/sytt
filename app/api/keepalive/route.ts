import { NextResponse } from "next/server";
import { fetchStories } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hit by Vercel Cron several times a day so the Supabase free tier keeps
// seeing "user database activity" and does not get paused.
export async function GET() {
  try {
    await fetchStories();
    return NextResponse.json({ supabase: "ok" });
  } catch (err) {
    console.error("[keepalive] supabase", err);
    return NextResponse.json({ supabase: "failed" }, { status: 500 });
  }
}
