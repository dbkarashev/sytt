import type { Story } from "./types";
import {
  addStory as addStoryMock,
  getAllStories as getAllMock,
  updateStory as updateStoryMock,
} from "./store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const isLive = Boolean(url && secretKey);

type SupabaseRow = {
  id: string;
  lat: number;
  lng: number;
  text: string;
  feeling: string | null;
  coped: string | null;
  lang: "en" | "ru";
  created_at: string;
};

function rowToStory(r: SupabaseRow): Story {
  return {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    text: r.text,
    feeling: r.feeling,
    coped: r.coped,
    lang: r.lang,
    createdAt: r.created_at,
  };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey}`,
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchStories(): Promise<Story[]> {
  if (!isLive) return getAllMock();
  const rows = await rest<SupabaseRow[]>(
    "stories?select=*&order=created_at.desc&limit=1000",
  );
  return rows.map(rowToStory);
}

export async function insertStory(input: Omit<Story, "id" | "createdAt"> & {
  ipHash: string;
}): Promise<Story> {
  if (!isLive) {
    const story: Story = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lat: input.lat,
      lng: input.lng,
      text: input.text,
      feeling: input.feeling,
      coped: input.coped,
      lang: input.lang,
      createdAt: new Date().toISOString(),
    };
    addStoryMock(story);
    return story;
  }
  const rows = await rest<SupabaseRow[]>("stories", {
    method: "POST",
    body: JSON.stringify([
      {
        lat: input.lat,
        lng: input.lng,
        text: input.text,
        feeling: input.feeling,
        coped: input.coped,
        lang: input.lang,
        ip_hash: input.ipHash,
      },
    ]),
  });
  if (!rows.length) throw new Error("Supabase returned no row");
  return rowToStory(rows[0]);
}

type RowWithHash = SupabaseRow & { ip_hash: string | null };

export async function getStoryOwner(id: string): Promise<{ ipHash: string | null } | null> {
  if (!isLive) {
    const all = getAllMock();
    const s = all.find((x) => x.id === id);
    return s ? { ipHash: (s as Story & { ipHash?: string }).ipHash ?? null } : null;
  }
  const rows = await rest<RowWithHash[]>(
    `stories?id=eq.${encodeURIComponent(id)}&select=id,ip_hash&limit=1`,
  );
  if (!rows.length) return null;
  return { ipHash: rows[0].ip_hash };
}

export async function updateStory(input: {
  id: string;
  text: string;
  feeling: string | null;
  coped: string | null;
  lang: "en" | "ru";
}): Promise<Story> {
  if (!isLive) {
    const updated = updateStoryMock(input.id, {
      text: input.text,
      feeling: input.feeling,
      coped: input.coped,
      lang: input.lang,
    });
    if (!updated) throw new Error("Story not found");
    return updated;
  }
  const rows = await rest<SupabaseRow[]>(
    `stories?id=eq.${encodeURIComponent(input.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        text: input.text,
        feeling: input.feeling,
        coped: input.coped,
        lang: input.lang,
      }),
    },
  );
  if (!rows.length) throw new Error("Supabase returned no row");
  return rowToStory(rows[0]);
}

export const supabaseLive = isLive;
