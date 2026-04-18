import { seedStories } from "./seed";
import type { Story } from "./types";

declare global {
  var __syttStore: Story[] | undefined;
  var __syttRateLimit: Map<string, number[]> | undefined;
}

function ensureStore(): Story[] {
  if (!globalThis.__syttStore) {
    globalThis.__syttStore = [...seedStories];
  }
  return globalThis.__syttStore;
}

function ensureRateLimit(): Map<string, number[]> {
  if (!globalThis.__syttRateLimit) {
    globalThis.__syttRateLimit = new Map();
  }
  return globalThis.__syttRateLimit;
}

export function getAllStories(): Story[] {
  return ensureStore();
}

export function addStory(story: Story): Story {
  const store = ensureStore();
  store.unshift(story);
  return story;
}

export function updateStory(
  id: string,
  patch: Partial<Pick<Story, "text" | "feeling" | "coped" | "lang">>,
): Story | null {
  const store = ensureStore();
  const i = store.findIndex((s) => s.id === id);
  if (i === -1) return null;
  store[i] = { ...store[i], ...patch };
  return store[i];
}

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 3;

export function isRateLimited(ipHash: string): boolean {
  const map = ensureRateLimit();
  const now = Date.now();
  const recent = (map.get(ipHash) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  map.set(ipHash, recent);
  return recent.length >= RATE_MAX;
}

export function recordSubmission(ipHash: string): void {
  const map = ensureRateLimit();
  const now = Date.now();
  const recent = (map.get(ipHash) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  map.set(ipHash, recent);
}
