import { NextResponse, type NextRequest } from "next/server";
import { getStoryOwner, updateStory } from "@/lib/supabase";
import { moderate } from "@/lib/moderate";
import { hashIp, ipFromHeaders } from "@/lib/ip";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, reason: "missing_id" }, { status: 400 });

  let body: { text?: unknown; feeling?: unknown; coped?: unknown; lang?: unknown };
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
  const copedRaw =
    typeof body.coped === "string" ? body.coped.trim().toLocaleLowerCase() : "";
  const coped = copedRaw.length > 0 ? copedRaw : null;
  const lang: Lang = body.lang === "ru" ? "ru" : "en";

  if (!text) return NextResponse.json({ ok: false, reason: "missing_text" }, { status: 400 });

  const owner = await getStoryOwner(id);
  if (!owner) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const ipHash = hashIp(ipFromHeaders(req.headers));
  if (owner.ipHash && owner.ipHash !== ipHash) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const moderation = await moderate(text, feeling, coped);
  if (!moderation.approved) {
    return NextResponse.json({ ok: false, reason: "rejected" }, { status: 422 });
  }

  try {
    const story = await updateStory({ id, text, feeling, coped, lang });
    return NextResponse.json({ ok: true, story });
  } catch (err) {
    console.error("[stories.PATCH]", err);
    return NextResponse.json({ ok: false, reason: "store_failed" }, { status: 500 });
  }
}
