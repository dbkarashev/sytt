import { createHash } from "node:crypto";

export function ipFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_SALT ?? "save-yourself-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
