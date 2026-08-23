// Parsing for the one-line daily reminder syntax used on /board/rem:
//
//   Спорт; 14:00; 18:00; 21:00
//
// Deliberately forgiving — on a phone the separators and the leading zero are
// the first things to get lost, so ";", "," and plain spaces all work, and
// "14", "1400", "14.30" all mean what they look like.

export type ParsedDailyLine = { text: string; times: string[] };

const TIME_TOKEN = /^(\d{1,2})[:.\-]?(\d{2})?$/;
const INLINE_TIME = /\b(\d{1,2})[:.](\d{2})\b/g;

function toTime(h: number, m: number): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "14" → 14:00, "1400" → 14:00, "14.30" → 14:30, "9:05" → 09:05
function parseTimeToken(token: string): string | null {
  if (/^\d{3,4}$/.test(token)) {
    const h = +token.slice(0, token.length - 2);
    const m = +token.slice(-2);
    return toTime(h, m);
  }
  const m = TIME_TOKEN.exec(token);
  if (!m) return null;
  return toTime(+m[1], m[2] === undefined ? 0 : +m[2]);
}

/**
 * Split "Спорт; 14:00; 18:00" into its text and its times. Times may also be
 * comma-separated or simply written inside the text ("Спорт 14:00 18:00").
 * Returns an error string instead when the line has no text or no valid time.
 */
export function parseDailyLine(line: string): ParsedDailyLine | { error: string } {
  const tokens = String(line || "")
    .split(/[;,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const times: string[] = [];
  const textParts: string[] = [];
  for (const token of tokens) {
    const t = parseTimeToken(token);
    if (t) times.push(t);
    else textParts.push(token);
  }

  // "Спорт 14:00 18:00" — no separators at all, times sit inside the text
  let text = textParts.join(", ");
  text = text.replace(INLINE_TIME, (whole, h, m) => {
    const t = toTime(+h, +m);
    if (!t) return whole;
    times.push(t);
    return " ";
  });

  text = text.replace(/\s+/g, " ").replace(/^[\s.,;–-]+|[\s.,;–-]+$/g, "").trim();

  if (!text) return { error: "Добавьте текст: Спорт; 14:00; 18:00" };
  if (!times.length) return { error: "Укажите время: Спорт; 14:00; 18:00" };

  const unique = [...new Set(times)].sort();
  if (unique.length > 24) return { error: "Не больше 24 напоминаний в день" };

  return { text: text.slice(0, 300), times: unique };
}

/** Times as stored in the DB column ("14:00,18:00,21:00") → array. */
export function splitTimes(times: string): string[] {
  return times.split(",").map((t) => t.trim()).filter(Boolean);
}
