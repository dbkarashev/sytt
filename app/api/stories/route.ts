import { NextResponse, type NextRequest } from "next/server";
import { fetchStories, insertStory } from "@/lib/supabase";
import { moderate } from "@/lib/moderate";
import { isRateLimited, recordSubmission } from "@/lib/store";
import { hashIp, ipFromHeaders } from "@/lib/ip";
import { geolocateIp } from "@/lib/geolocate";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const stories = await fetchStories();
    return NextResponse.json(
      { stories },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("[stories.GET]", err);
    return NextResponse.json({ stories: [], error: "fetch_failed" }, { status: 500 });
  }
}

const DEV_FALLBACK_COORD = { lat: 55.8, lng: 37.6 };

export async function POST(req: NextRequest) {
  let body: { text?: unknown; feeling?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const text =
    typeof body.text === "string" ? body.text.trim().toLocaleLowerCase() : "";
  const feelingRaw =
    typeof body.feeling === "string" ? body.feeling.trim().toLocaleLowerCase() : "";
  const feeling = feelingRaw.length > 0 ? feelingRaw : null;
  // coped is not accepted on create — only via PATCH after the story exists.
  const coped = null;
  const lang: Lang = body.lang === "ru" ? "ru" : "en";

  if (!text) {
    return NextResponse.json({ ok: false, reason: "missing_text" }, { status: 400 });
  }

  const ip = ipFromHeaders(req.headers);
  const ipHash = hashIp(ip);
  if (isRateLimited(ipHash)) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  const moderation = await moderate(text, feeling, coped);
  if (!moderation.approved) {
    return NextResponse.json({ ok: false, reason: "rejected" }, { status: 422 });
  }

  let coords = await geolocateIp(ip);
  if (!coords) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, reason: "geo_failed" }, { status: 500 });
    }
    coords = DEV_FALLBACK_COORD;
  }

  try {
    const story = await insertStory({
      lat: coords.lat,
      lng: coords.lng,
      text,
      feeling,
      coped,
      lang,
      ipHash,
    });
    recordSubmission(ipHash);
    return NextResponse.json({ ok: true, story }, { status: 201 });
  } catch (err) {
    console.error("[stories.POST]", err);
    return NextResponse.json({ ok: false, reason: "store_failed" }, { status: 500 });
  }
}
