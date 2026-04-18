import { findStopwordEn } from "./stopwords/en";

export type ModerationResult = {
  approved: boolean;
  reason?: string;
};

const URL_RE = /(https?:\/\/|www\.|\.com|\.ru|\.org|\.io|\.net|\.app|\bt\.me\b)/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /\+?\d[\d\s\-()]{6,}/;
const REPEAT_RE = /(.)\1{3,}/;

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 6000;

function checkRegex(
  text: string,
  feeling: string | null,
  coped: string | null,
): ModerationResult {
  const combined = [text, feeling ?? "", coped ?? ""].join("\n").trim();

  if (text.length < 20) return { approved: false, reason: "too_short" };
  if (text.length > 500) return { approved: false, reason: "too_long" };
  if ((feeling ?? "").length > 300) return { approved: false, reason: "feeling_too_long" };
  if ((coped ?? "").length > 300) return { approved: false, reason: "coped_too_long" };

  if (text.split(/\s+/).filter(Boolean).length < 3) {
    return { approved: false, reason: "too_few_words" };
  }
  if (URL_RE.test(combined)) return { approved: false, reason: "contains_url" };
  if (EMAIL_RE.test(combined)) return { approved: false, reason: "contains_email" };
  if (PHONE_RE.test(combined)) return { approved: false, reason: "contains_phone" };

  for (const [name, value] of [
    ["text", text],
    ["feeling", feeling ?? ""],
    ["coped", coped ?? ""],
  ] as const) {
    if (!value) continue;
    if (REPEAT_RE.test(value)) {
      return { approved: false, reason: `repeated_chars:${name}` };
    }
    const letters = value.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
    if (letters.length > 8 && letters === letters.toUpperCase()) {
      return { approved: false, reason: `all_caps:${name}` };
    }
  }

  const en = findStopwordEn(combined);
  if (en) return { approved: false, reason: `stopword:${en.trim()}` };

  return { approved: true };
}

const CRISIS_PROMPT = `You moderate a platform where people share anonymous stories about hard times — depression, grief, loneliness, addiction, burnout, loss. Its purpose is to make vulnerable people feel less alone.

ALWAYS ALLOW (even if dark):
- Raw expression of suffering, pain, hopelessness, numbness, exhaustion
- First-person statements like "I want to die", "I can't go on", "I want to stop existing", "life feels pointless" — these are legitimate descriptions of emotional states on this platform, not threats
- Descriptions of mental illness, trauma, grief, loss, loneliness, addiction, panic
- Anger at oneself, at life circumstances, at unfair situations
- Stories in any language
- Quiet confessions: "I haven't spoken in weeks", "nobody knows I'm like this"

BLOCK:
- Attacks, insults, slurs, or threats DIRECTED AT OTHER PEOPLE (e.g. "kys", "you're a bitch", "kill him")
- Calls for violence against specific people or groups
- Explicit instructions or methods for suicide/self-harm (e.g. "here is how to overdose")
- Spam or promotion: crypto, gambling, adult content, paid services, referral codes
- Identity attacks used as slurs (racism, homophobia, misogyny targeting a group)
- Clear trolling unrelated to personal experience
- Impersonation or obvious fabrication for attention

Be permissive with self-expression of pain. Be strict with aggression toward others and spam.

Output exactly one JSON object, no prose, no markdown:
{"allow": true|false, "reason": "<short tag if blocked, empty string if allowed>"}

Example reasons if blocking: "attack_on_others", "spam", "self_harm_instructions", "slur", "troll".`;

type GroqParsed = { allow: boolean; reason?: string };

function parseGroqJson(raw: string): GroqParsed | null {
  const trimmed = raw.trim();
  // Strip ``` fences if the model wraps anyway.
  const cleaned = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (typeof obj.allow === "boolean") {
      return { allow: obj.allow, reason: typeof obj.reason === "string" ? obj.reason : undefined };
    }
  } catch {
    // fall through
  }
  return null;
}

async function checkGroq(text: string): Promise<ModerationResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      return { approved: false, reason: "groq_missing_key" };
    }
    return { approved: true, reason: "groq_skipped" };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), GROQ_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          { role: "system", content: CRISIS_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return { approved: false, reason: `groq_http_${res.status}` };
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseGroqJson(content);
    if (!parsed) return { approved: false, reason: "groq_parse_failed" };
    if (parsed.allow) return { approved: true };
    return { approved: false, reason: `groq:${parsed.reason ?? "blocked"}` };
  } catch {
    return { approved: false, reason: "groq_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export async function moderate(
  text: string,
  feeling: string | null,
  coped: string | null,
): Promise<ModerationResult> {
  const layer1 = checkRegex(text, feeling, coped);
  if (!layer1.approved) return layer1;

  const parts = [text];
  if (feeling) parts.push(feeling);
  if (coped) parts.push(coped);
  return checkGroq(parts.join("\n\n"));
}
