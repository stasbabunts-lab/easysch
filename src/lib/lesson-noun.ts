/**
 * The word a specialist uses for their meetings — "заняття", "консультація",
 * "тренування" and so on. Stored as a key in `Teacher.lessonNoun`.
 *
 * Why a fixed list and not free text: Ukrainian declines. The same word has to
 * appear as "Ви завершили консультаці**ю**", "ціна консультаці**ї**", "5
 * консультаці**й**", and any adjective in front of it agrees in gender —
 * "щотижнев**а** консультація" vs "щотижнев**е** заняття". A free-text field
 * cannot supply those forms, which is exactly why the one teacher who used it
 * typed the accusative "консультацію": the field only ever landed in a single
 * sentence. Presets carry every form we need.
 */

export type Gender = "m" | "f" | "n";

export interface LessonNoun {
  /** Value stored in Teacher.lessonNoun. */
  key: string;
  gender: Gender;
  /** Називний: "консультація" — Найближча ___, Тип: ___ */
  nom: string;
  /** Родовий: "консультації" — ціна ___, після ___, до ___ */
  gen: string;
  /** Знахідний: "консультацію" — Ви завершили ___, нагадування про ___ */
  acc: string;
  /** Називний множини: "консультації" — Найближчі ___, 2 ___ */
  plural: string;
  /** Родовий множини: "консультацій" — немає ___, 5 ___, список ___ */
  genPl: string;
}

export const DEFAULT_LESSON_NOUN_KEY = "lesson";

/** Presets offered in the settings dropdown, in the order shown. */
export const LESSON_NOUNS: LessonNoun[] = [
  { key: "lesson",       gender: "n", nom: "заняття",      gen: "заняття",      acc: "заняття",      plural: "заняття",      genPl: "занять" },
  { key: "class",        gender: "m", nom: "урок",         gen: "уроку",        acc: "урок",         plural: "уроки",        genPl: "уроків" },
  { key: "consultation", gender: "f", nom: "консультація", gen: "консультації", acc: "консультацію", plural: "консультації", genPl: "консультацій" },
  { key: "session",      gender: "f", nom: "сесія",        gen: "сесії",        acc: "сесію",        plural: "сесії",        genPl: "сесій" },
  { key: "meeting",      gender: "f", nom: "зустріч",      gen: "зустрічі",     acc: "зустріч",      plural: "зустрічі",     genPl: "зустрічей" },
  { key: "training",     gender: "n", nom: "тренування",   gen: "тренування",   acc: "тренування",   plural: "тренування",   genPl: "тренувань" },
  { key: "visit",        gender: "m", nom: "візит",        gen: "візиту",       acc: "візит",        plural: "візити",       genPl: "візитів" },
  { key: "appointment",  gender: "m", nom: "прийом",       gen: "прийому",      acc: "прийом",       plural: "прийоми",      genPl: "прийомів" },
  { key: "procedure",    gender: "f", nom: "процедура",    gen: "процедури",    acc: "процедуру",    plural: "процедури",    genPl: "процедур" },
  { key: "rehearsal",    gender: "f", nom: "репетиція",    gen: "репетиції",    acc: "репетицію",    plural: "репетиції",    genPl: "репетицій" },
];

const BY_KEY = new Map(LESSON_NOUNS.map((n) => [n.key, n]));

/** Any inflected form → preset, so pre-dropdown free text still resolves. */
const BY_FORM = new Map<string, LessonNoun>();
for (const noun of LESSON_NOUNS) {
  for (const form of [noun.nom, noun.gen, noun.acc, noun.plural, noun.genPl]) {
    if (!BY_FORM.has(form)) BY_FORM.set(form, noun);
  }
}

export const FALLBACK_LESSON_NOUN = BY_KEY.get(DEFAULT_LESSON_NOUN_KEY)!;

/**
 * Resolve whatever sits in `Teacher.lessonNoun` into a full form set: a preset
 * key, a legacy inflected word, or — as a last resort — an unknown custom word
 * used unchanged everywhere (grammatically rough, but nothing is lost).
 */
export function resolveLessonNoun(stored?: string | null): LessonNoun {
  const raw = stored?.trim();
  if (!raw) return FALLBACK_LESSON_NOUN;

  const byKey = BY_KEY.get(raw);
  if (byKey) return byKey;

  const byForm = BY_FORM.get(raw.toLowerCase());
  if (byForm) return byForm;

  return { key: "custom", gender: "n", nom: raw, gen: raw, acc: raw, plural: raw, genPl: raw };
}

/**
 * Value to persist for a settings submission. Accepts a key or any known form;
 * unknown input keeps the previous behaviour of storing the word as typed.
 */
export function normalizeLessonNounInput(raw?: string | null): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_LESSON_NOUN_KEY;
  if (BY_KEY.has(value)) return value;
  const byForm = BY_FORM.get(value.toLowerCase());
  if (byForm) return byForm.key;
  return value.slice(0, 30);
}

// ── Adjective agreement ───────────────────────────────────────────────────────
// Only singular forms need a table: Ukrainian plural adjectives do not inflect
// by gender ("найближчі заняття" / "найближчі консультації"), so plural phrases
// are written out literally at the call site.

type AdjKind = "weekly" | "oneTime" | "group" | "nearest" | "each";

const ADJECTIVES: Record<AdjKind, Record<"nom" | "gen" | "instr", Record<Gender, string>>> = {
  weekly: {
    nom:   { m: "щотижневий",   f: "щотижнева",  n: "щотижневе" },
    gen:   { m: "щотижневого",  f: "щотижневої", n: "щотижневого" },
    instr: { m: "щотижневим",   f: "щотижневою", n: "щотижневим" },
  },
  oneTime: {
    nom:   { m: "разовий",   f: "разова",  n: "разове" },
    gen:   { m: "разового",  f: "разової", n: "разового" },
    instr: { m: "разовим",   f: "разовою", n: "разовим" },
  },
  group: {
    nom:   { m: "груповий",   f: "групова",  n: "групове" },
    gen:   { m: "групового",  f: "групової", n: "групового" },
    instr: { m: "груповим",   f: "груповою", n: "груповим" },
  },
  nearest: {
    nom:   { m: "найближчий",   f: "найближча",  n: "найближче" },
    gen:   { m: "найближчого",  f: "найближчої", n: "найближчого" },
    instr: { m: "найближчим",   f: "найближчою", n: "найближчим" },
  },
  each: {
    nom:   { m: "кожний",   f: "кожна",  n: "кожне" },
    gen:   { m: "кожного",  f: "кожної", n: "кожного" },
    instr: { m: "кожним",   f: "кожною", n: "кожним" },
  },
};

/** Adjective agreeing with `noun`, e.g. adj("weekly", consultation) → "щотижнева". */
export function adj(kind: AdjKind, noun: LessonNoun, form: "nom" | "gen" | "instr" = "nom"): string {
  return ADJECTIVES[kind][form][noun.gender];
}

const DEMONSTRATIVE: Record<"acc" | "gen", Record<Gender, string>> = {
  // Inanimate masculine accusative matches the nominative: "цей урок".
  acc: { m: "цей",   f: "цю",   n: "це" },
  gen: { m: "цього", f: "цієї", n: "цього" },
};

/** "це заняття" / "цю консультацію" / "цей урок" — demonstrative + noun. */
export function thisNoun(noun: LessonNoun, form: "acc" | "gen" = "acc"): string {
  return `${DEMONSTRATIVE[form][noun.gender]} ${form === "acc" ? noun.acc : noun.gen}`;
}

/** Uppercase the first letter — for adjectives that open a sentence. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Numeral agreement: "1 заняття", "2 заняття", "5 занять", "11 занять". */
export function countNoun(n: number, noun: LessonNoun): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${noun.genPl}`;
  if (mod10 === 1) return `${n} ${noun.nom}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${noun.plural}`;
  return `${n} ${noun.genPl}`;
}
