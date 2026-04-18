import { seedStories } from "./seed";
import type { Story } from "./types";

declare global {
  var __syttStore: Story[] | undefined;
}

function ensureStore(): Story[] {
  if (!globalThis.__syttStore) {
    globalThis.__syttStore = [...seedStories];
  }
  return globalThis.__syttStore;
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
