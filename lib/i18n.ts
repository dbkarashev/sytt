import en from "@/messages/en.json";

export type Messages = typeof en;

export function useLang(): { t: Messages } {
  return { t: en };
}

export const messages: Messages = en;
