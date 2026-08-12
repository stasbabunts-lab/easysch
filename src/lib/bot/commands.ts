import type { Api } from "grammy";
import { prisma } from "@/lib/prisma";
import { resolveLessonNoun, adj, cap, FALLBACK_LESSON_NOUN, type LessonNoun } from "@/lib/lesson-noun";

/**
 * The bot's "/" menu is per-chat, not global.
 *
 * Telegram keeps one command list per scope. With a single default list every
 * client saw /today, /debts, /mystudents — teacher commands they can never use.
 * We now compute the list for each chat from the roles that chat actually has;
 * a person who is both a specialist and somebody else's client simply gets both
 * blocks. Handlers never depend on the menu, so every command keeps working
 * even when it is not listed.
 */

export interface ChatRoles {
  isTeacher: boolean;
  isClient: boolean;
  /** The teacher's own word for lessons (only when isTeacher). */
  teacherNoun: LessonNoun | null;
  /** Word used by the client's specialists — null when they disagree. */
  clientNoun: LessonNoun | null;
}

export async function getChatRoles(chatId: string): Promise<ChatRoles> {
  const [teacher, linked] = await Promise.all([
    prisma.teacher.findFirst({
      where: { telegramChatId: chatId },
      select: { lessonNoun: true },
    }),
    prisma.student.findMany({
      where: { telegramId: chatId },
      select: { teacher: { select: { lessonNoun: true } } },
    }),
  ]);

  // Several specialists can use different words — fall back to the default
  // rather than picking one of them for a shared menu or header.
  const clientNouns = new Set(linked.map((s) => resolveLessonNoun(s.teacher.lessonNoun).key));
  const clientNoun =
    linked.length > 0 && clientNouns.size === 1
      ? resolveLessonNoun(linked[0].teacher.lessonNoun)
      : null;

  return {
    isTeacher: !!teacher,
    isClient: linked.length > 0,
    teacherNoun: teacher ? resolveLessonNoun(teacher.lessonNoun) : null,
    clientNoun,
  };
}

interface Command {
  command: string;
  description: string;
}

const COMMON: Command[] = [
  { command: "start", description: "Підключити бот за кодом" },
  { command: "help", description: "Усі команди" },
  { command: "support", description: "Зв'язатися з підтримкою" },
];

function teacherCommands(noun: LessonNoun): Command[] {
  return [
    { command: "today", description: `${cap(noun.plural)} сьогодні` },
    { command: "week", description: `${cap(noun.plural)} на 7 днів` },
    { command: "debts", description: "Клієнти з боргом" },
    { command: "mystudents", description: "Список клієнтів" },
  ];
}

function clientCommands(noun: LessonNoun): Command[] {
  return [
    { command: "next", description: `${cap(adj("nearest", noun))} ${noun.nom}` },
    { command: "lessons", description: `${cap(noun.plural)} на місяць` },
    { command: "balance", description: "Ваш баланс" },
    { command: "pay", description: "Реквізити для оплати" },
    { command: "my", description: "Ваші спеціалісти" },
    { command: "unlink", description: "Відписатися від спеціаліста" },
  ];
}

export function commandsForRoles(roles: ChatRoles, fallbackNoun: LessonNoun): Command[] {
  const list = [...COMMON];
  if (roles.isTeacher) list.push(...teacherCommands(roles.teacherNoun ?? fallbackNoun));
  // Everyone who is not a specialist gets the client block: a fresh chat is far
  // more likely to be a client about to enter their code than a specialist.
  if (roles.isClient || !roles.isTeacher) list.push(...clientCommands(roles.clientNoun ?? fallbackNoun));
  return list;
}

/** Chats whose menu this process already pushed — Telegram stores it server-side. */
const synced = new Set<string>();

/**
 * Push the role-matched menu for one chat. Called after every link/unlink and
 * once per chat per process, so long-linked users get their menu fixed the
 * first time they touch the bot after a deploy — no migration needed.
 */
export async function syncChatCommands(api: Api, chatId: string, force = false): Promise<void> {
  if (!force && synced.has(chatId)) return;
  synced.add(chatId);
  try {
    const roles = await getChatRoles(chatId);
    await api.setMyCommands(commandsForRoles(roles, FALLBACK_LESSON_NOUN), {
      scope: { type: "chat", chat_id: Number(chatId) },
    });
  } catch {
    // A stale chat id or a rate limit must never break the update being handled.
  }
}
