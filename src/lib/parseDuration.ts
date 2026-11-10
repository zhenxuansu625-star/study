/**
 * Parse a human duration into minutes.
 * Accepts: "90", "90m", "90 mins", "1.5h", "2h 30m", "2h30", "1:30", "2 hours", "1 hr 15 min".
 * Returns null when the text isn't a positive duration.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  // "1:30" → 90
  const colon = /^(\d+):([0-5]?\d)$/.exec(s);
  if (colon) return positive(parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10));

  // bare number → minutes
  if (/^\d+(\.\d+)?$/.test(s)) return positive(Math.round(parseFloat(s)));

  const re = /(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|minutes|minute|mins|min|m)?/g;
  let total = 0;
  let matchedAll = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1]);
    // A number with no unit counts as minutes, so "2h30" → 150.
    const isHours = m[2] ? m[2].startsWith('h') : false;
    total += isHours ? n * 60 : n;
    matchedAll += m[0];
  }
  // Reject text with stray characters (anything other than what we matched, spaces and "and"/",").
  const leftover = s.replace(re, '').replace(/\band\b|,|\s/g, '');
  if (leftover.length > 0 || !matchedAll) return null;
  return positive(Math.round(total));
}

function positive(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}
