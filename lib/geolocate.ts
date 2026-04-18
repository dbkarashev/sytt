type IpApiResponse = {
  latitude?: number;
  longitude?: number;
  error?: boolean;
};

export type GeoResult = { lat: number; lng: number } | null;

function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

function isPrivateOrLocal(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

export async function geolocateIp(ip: string): Promise<GeoResult> {
  if (isPrivateOrLocal(ip)) return null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: ac.signal,
      headers: { "User-Agent": "save-yourself/1.0" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as IpApiResponse;
    if (data.error) return null;
    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return null;
    return { lat: roundCoord(data.latitude), lng: roundCoord(data.longitude) };
  } catch {
    return null;
  }
}
