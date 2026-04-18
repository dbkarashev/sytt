import { NextResponse, type NextRequest } from "next/server";
import { ipFromHeaders } from "@/lib/ip";
import { geolocateIp } from "@/lib/geolocate";

export const runtime = "nodejs";

const DEV_FALLBACK = { lat: 55.8, lng: 37.6 };

export async function GET(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);
  const coords = await geolocateIp(ip);
  if (coords) return NextResponse.json(coords);
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json(DEV_FALLBACK);
  }
  return NextResponse.json({ lat: null, lng: null }, { status: 204 });
}
