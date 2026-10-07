// Parsing for the one-line daily / recurring reminder syntax used on /board/rem:
//
//   Спорт; 14:00; 18:00; 21:00
//   Спорт; пн14; ср18:00; 21:00
//
// Deliberately forgiving — on a phone the separators and the leading zero are
// the first things to get lost, so ";", "," and plain spaces all work, and
// "14", "1400", "14.30", "пн14", "вт 15:00" all mean what they look like.

export type ParsedDailyLine = { text: string; times: string[] };

export const DOW_CANONICAL = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export function parseSingleDay(s: string): number | null {
  const norm = s.trim().toLowerCase().replace(/['’]/g, "");
  if (/^(пн|пон|понедельник|понеділок|mon|monday)$/.test(norm)) return 1;
  if (/^(вт|вто|вторник|вівторок|tue|tues|tuesday)$/.test(norm)) return 2;
  if (/^(ср|сре|среда|середа|wed|wednesday)$/.test(norm)) return 3;
  if (/^(чт|чет|четверг|четвер|thu|thur|thurs|thursday)$/.test(norm)) return 4;
  if (/^(пт|пят|пятница|пятниця|fri|friday)$/.test(norm)) return 5;
  if (/^(сб|суб|суббота|субота|sat|saturday)$/.test(norm)) return 6;
  if (/^(вс|вос|воскресенье|нд|нед|неділя|недиля|sun|sunday)$/.test(norm)) return 0;
  return null;
}

export function parseDaysSpec(s: string): number[] | null {
  const clean = s.trim().toLowerCase().replace(/^(в|во)\s+/i, "");
  if (!clean) return null;

  // Day range: "пн-пт", "пн - пт", "пн–пт", "сб-вс"
  const rangeMatch = clean.match(/^([a-zа-яё]+)\s*[-–—]\s*([a-zа-яё]+)$/i);
  if (rangeMatch) {
    const d1 = parseSingleDay(rangeMatch[1]);
    const d2 = parseSingleDay(rangeMatch[2]);
    if (d1 !== null && d2 !== null) {
      const res: number[] = [];
      let cur = d1;
      while (true) {
        res.push(cur);
        if (cur === d2) break;
        cur = (cur + 1) % 7;
      }
      return res;
    }
    return null;
  }

  // Comma / slash / space separated: "пн, ср", "пн/ср"
  const parts = clean.split(/[,/ ]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const res: number[] = [];
  for (const part of parts) {
    const d = parseSingleDay(part);
    if (d === null) return null;
    if (!res.includes(d)) res.push(d);
  }
  return res.length > 0 ? res : null;
}

function toTime(h: number, m: number): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TIME_TOKEN = /^(\d{1,2})[:.\-]?(\d{2})?$/;

// "14" → 14:00, "1400" → 14:00, "14.30" → 14:30, "9:05" → 09:05
export function parseTimeToken(token: string): string | null {
  const t = token.trim();
  if (/^\d{3,4}$/.test(t)) {
    const h = +t.slice(0, t.length - 2);
    const m = +t.slice(-2);
    return toTime(h, m);
  }
  const m = TIME_TOKEN.exec(t);
  if (!m) return null;
  return toTime(+m[1], m[2] === undefined ? 0 : +m[2]);
}

/**
 * Parses a single token that may be a plain time ("14:00", "14") or
 * day(s) + time ("пн14", "пн 14", "пн14:00", "пн, ср 14:00", "пн-пт 10:00").
 * Returns an array of canonical slot strings (e.g. ["пн 14:00"]) or null.
 */
export function parseSlotToken(token: string): string[] | null {
  const t = token.trim();
  const plainTime = parseTimeToken(t);
  if (plainTime) return [plainTime];

  const m = t.match(/^(.*?)(?:[:.\-\s]*|\s+)(\d{3,4}|\d{1,2}(?:[:.\-]\d{2})?|\d{1,2})$/i);
  if (m) {
    const dayStr = m[1];
    const timeStr = m[2];
    const time = parseTimeToken(timeStr);
    if (time) {
      const days = parseDaysSpec(dayStr);
      if (days && days.length > 0) {
        return days.map((d) => `${DOW_CANONICAL[d]} ${time}`);
      }
    }
  }
  return null;
}

function slotRank(slot: string): { dow: number; time: string } {
  const parts = slot.trim().split(/\s+/);
  if (parts.length === 1) {
    return { dow: 0, time: parts[0] };
  }
  const dIdx = DOW_CANONICAL.indexOf(parts[0] as (typeof DOW_CANONICAL)[number]);
  const dow = dIdx === 0 ? 7 : (dIdx > 0 ? dIdx : 8);
  return { dow, time: parts[1] };
}

function sortSlots(slots: string[]): string[] {
  return [...new Set(slots)].sort((a, b) => {
    const ra = slotRank(a);
    const rb = slotRank(b);
    if (ra.dow !== rb.dow) return ra.dow - rb.dow;
    return ra.time.localeCompare(rb.time);
  });
}

/**
 * Split a rule definition line into its text and its times.
 * Supports:
 *   "Спорт; 14:00; 18:00"
 *   "Спорт; пн14; ср18:00; 21:00"
 *   "Спорт; пн, ср 14:00"
 *   "Спорт пн14"
 * Returns an error string instead when the line has no text or no valid time.
 */
export function parseDailyLine(line: string): ParsedDailyLine | { error: string } {
  const tokens = String(line || "")
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const times: string[] = [];
  const textParts: string[] = [];

  for (const token of tokens) {
    const slots = parseSlotToken(token);
    if (slots) {
      times.push(...slots);
    } else {
      textParts.push(token);
    }
  }

  let text = textParts.join("; ");

  // Inline attached day+time, e.g. "пн14", "вт15:30", "пн1430"
  text = text.replace(/(?:^|\s+)([a-zа-яё]+)(\d{1,2}(?:[:.]\d{2})?|\d{3,4})(?=[^\wа-яё]|$)/gi, (whole, dayPart, timePart) => {
    const time = parseTimeToken(timePart);
    if (!time) return whole;
    const days = parseDaysSpec(dayPart);
    if (!days) return whole;
    days.forEach((d) => times.push(`${DOW_CANONICAL[d]} ${time}`));
    return " ";
  });

  // Inline day with space + time, e.g. "пн 14:00", "в пн 14:00", "пн, ср 14:00"
  text = text.replace(/(?:^|\s+)(?:(?:в|во)\s+)?([a-zа-яё]+(?:(?:\s*,\s*|\s*[-–—]\s*)[a-zа-яё]+)*)\s+(\d{1,2}[:.]\d{2}|\b\d{1,2}\b)(?=[^\wа-яё]|$)/gi, (whole, dayPart, timePart) => {
    const time = parseTimeToken(timePart);
    if (!time) return whole;
    const days = parseDaysSpec(dayPart);
    if (!days) return whole;
    days.forEach((d) => times.push(`${DOW_CANONICAL[d]} ${time}`));
    return " ";
  });

  // Inline plain time: "14:00", "18.30"
  text = text.replace(/(?:^|\s+)(\d{1,2})[:.](\d{2})(?=[^\wа-яё]|$)/g, (whole, h, m) => {
    const t = toTime(+h, +m);
    if (!t) return whole;
    times.push(t);
    return " ";
  });

  text = text.replace(/\s+/g, " ").replace(/^[\s.,;–-]+|[\s.,;–-]+$/g, "").trim();

  if (!text) return { error: "Добавьте текст: Спорт; 14:00; 18:00" };
  if (!times.length) return { error: "Укажите время: Спорт; 14:00; 18:00" };

  const sorted = sortSlots(times);
  if (sorted.length > 35) return { error: "Не больше 35 напоминаний" };

  return { text: text.slice(0, 300), times: sorted };
}

/** Times as stored in the DB column ("14:00,пн 18:00,21:00") → array. */
export function splitTimes(times: string): string[] {
  return times.split(",").map((t) => t.trim()).filter(Boolean);
}

/**
 * Returns the "HH:MM" string if this slot applies to the given day of week (0..6),
 * or null if this slot is scheduled for another day.
 * slot can be "14:00" (applies to all days) or "пн 14:00" (applies only to Monday).
 */
export function getSlotTimeForDay(slot: string, dow: number): string | null {
  const parts = slot.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const dayCode = parts[0].toLowerCase();
  const slotDow = parseSingleDay(dayCode);
  if (slotDow === null || slotDow === dow) {
    return parts[1];
  }
  return null;
}
