export const stopwordsEn: string[] = [
  "fuck", "fucking", "fucker", "shit", "bitch", "asshole", "cunt", "dick", "pussy",
  "whore", "slut", "faggot", "fag", "retard", "retarded", "nigger", "nigga",

  "kill yourself", "kys", "go die", "die already", "neck yourself",
  "kill them", "kill all", "shoot up", "shoot them", "blow up",
  "rape", "raping", "molest",

  "buy now", "free money", "earn cash", "click here", "limited offer",
  "subscribe", "discount code", "promo code", "telegram t.me", "join my channel",
  "crypto", "btc", "eth ", "nft drop", "airdrop", "investment opportunity",

  "viagra", "cialis", "porn", "xxx ", "onlyfans",
];

export function findStopwordEn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of stopwordsEn) {
    if (lower.includes(w)) return w;
  }
  return null;
}
