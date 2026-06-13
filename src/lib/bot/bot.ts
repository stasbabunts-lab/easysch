import { Bot, Context } from "grammy";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/format";
import { sendTelegramMessage } from "@/lib/bot/reminders";
import { getStudentBalance } from "@/lib/balance";
import { kyivToday, kyivDateOffset } from "@/lib/time";

const token = process.env.TELEGRAM_BOT_TOKEN;
// Where teacher support messages are delivered (admin's Telegram chat id).
const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID;

// Lazy singleton — bot is only created when token is present
let _bot: Bot | null = null;
function getBot(): Bot {
  if (!_bot) {
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    _bot = new Bot(token);
    registerHandlers(_bot);
  }
  return _bot;
}
export { getBot as bot };

/** Returns displayName if set, otherwise name */
function tName(teacher: { name: string; displayName?: string | null }) {
  return teacher.displayName?.trim() || teacher.name;
}

/** Escape user-provided text before embedding it in an HTML-parsed message. */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Forward any user's message to the support chat, labelled by role (teacher /
// student / unknown). The operator replies to the forwarded message and the
// answer is routed back to the sender via the trailing #u<chatId> tag.
async function relaySupportMessage(ctx: Context, text: string): Promise<void> {
  if (!SUPPORT_CHAT_ID) {
    await ctx.reply("Підтримка тимчасово недоступна, спробуйте трохи згодом.").catch(() => null);
    return;
  }
  const fromId = String(ctx.from!.id);

  const teacher = await prisma.teacher.findFirst({
    where: { telegramChatId: fromId },
    select: { name: true, displayName: true },
  });
  let who: string;
  if (teacher) {
    who = `спеціаліст <b>${escapeHtml(tName(teacher))}</b>`;
  } else {
    const isStudent = await prisma.student.findFirst({
      where: { telegramId: fromId },
      select: { id: true },
    });
    who = isStudent ? "клієнт" : "користувач";
  }

  const from = ctx.from!;
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const handle = from.username ? `@${from.username}` : fullName || "—";

  await sendTelegramMessage(
    SUPPORT_CHAT_ID,
    `📩 <b>Підтримка</b> · ${who} · ${escapeHtml(handle)}\n\n` +
      `${escapeHtml(text)}\n\n` +
      `<i>Відповідьте реплаєм на це повідомлення.</i>\n#u${fromId}`
  ).catch(() => null);

  await ctx.reply(
    "✅ Ваше повідомлення надіслано в підтримку. Відповімо вам тут якнайшвидше."
  ).catch(() => null);
}

function registerHandlers(bot: Bot) {

// ── /help — full command list (also populates the bot's "/" menu) ───────────────
const HELP_TEXT =
  "📋 <b>Усі команди</b>\n\n" +
  "🔗 <b>Загальні</b>\n" +
  "/start КОД — підключити бот\n" +
  "/help — цей список\n\n" +
  "👤 <b>Для спеціалістів</b>\n" +
  "/today — заняття сьогодні\n" +
  "/week — заняття на 7 днів\n" +
  "/debts — клієнти з боргом\n" +
  "/mystudents — список клієнтів\n" +
  "/support — зв'язатися з підтримкою\n\n" +
  "🎓 <b>Для клієнтів</b>\n" +
  "/next — найближче заняття\n" +
  "/lessons — заняття на місяць\n" +
  "/balance — ваш баланс\n" +
  "/pay — реквізити для оплати\n" +
  "/my — ваші спеціалісти\n" +
  "/unlink КОД — відписатися від спеціаліста";

bot.command("help", async (ctx) => {
  await ctx.reply(HELP_TEXT, { parse_mode: "HTML" }).catch(() => null);
});

bot.command("start", async (ctx) => {
  const args = ctx.match?.trim().toUpperCase();
  const telegramId = String(ctx.from!.id);
  const handle = ctx.from!.username ?? null;

  if (!args) {
    await ctx.reply(
      "Привіт! Введіть ваш особистий код:\n\n" +
        "<b>Для клієнтів:</b> /start ВАШ_КОД\n" +
        "<b>Для спеціалістів:</b> /start ВАШ_КОД\n\n" +
        "Код надає ваш спеціаліст (або знайдіть свій у налаштуваннях кабінету).",
      { parse_mode: "HTML" }
    );
    return;
  }

  // ── Check if this is a TEACHER code ──────────────────────────────
  const teacher = await prisma.teacher.findUnique({ where: { code: args } });
  if (teacher) {
    if (teacher.telegramChatId && teacher.telegramChatId !== telegramId) {
      await ctx.reply("❌ Цей код вже прив'язано до іншого Telegram-акаунту.");
      return;
    }
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { telegramChatId: telegramId },
    });
    await ctx.reply(
      `✅ Готово! Ви прив'язали Telegram як спеціаліст <b>${tName(teacher)}</b>.\n\n` +
        `Тепер ви будете отримувати нагадування про заняття.\n\n` +
        `Команди:\n` +
        `/today — заняття сьогодні\n` +
        `/week — заняття на 7 днів\n` +
        `/debts — клієнти з боргом\n` +
        `/mystudents — список клієнтів\n` +
        `/support — зв'язатися з підтримкою\n\n` +
        `💡 Ви також можете бути учнем інших спеціалістів — просто надішліть /start з кодом учня, який вам дасть ваш спеціаліст.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // ── Look up by STUDENT code ───────────────────────────────────────
  const student = await prisma.student.findUnique({
    where: { code: args },
    include: { teacher: { select: { name: true, displayName: true, telegramChatId: true } } },
  });

  if (!student) {
    await ctx.reply(
      "❌ Код не знайдено. Уточніть код у вашого спеціаліста."
    );
    return;
  }

  // Already linked to THIS telegram — just confirm
  if (student.telegramId === telegramId) {
    await ctx.reply(`ℹ️ Розклад <b>${tName(student.teacher)}</b> вже додано.`, { parse_mode: "HTML" });
    return;
  }

  // Linked to someone else
  if (student.telegramId && student.telegramId !== telegramId) {
    await ctx.reply("❌ Цей код вже прив'язано до іншого акаунту. Зверніться до спеціаліста.");
    return;
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { telegramId, telegramHandle: handle },
  });

  // Notify teacher that student connected
  if (student.teacher.telegramChatId) {
    const tgHandle = handle ? ` (@${handle})` : "";
    await sendTelegramMessage(
      student.teacher.telegramChatId,
      `🔔 <b>${student.name}</b>${tgHandle} підключив(ла) Telegram-бот.`
    ).catch(() => null);
  }

  const allLinked = await prisma.student.count({ where: { telegramId } });

  await ctx.reply(
    `✅ Додано розклад <b>${tName(student.teacher)}</b>!\n\n` +
      (allLinked > 1 ? `Усього спеціалістів: ${allLinked}. Список: /my\n\n` : "") +
      `Команди:\n` +
      `/next — найближче заняття\n` +
      `/lessons — заняття на місяць\n` +
      `/balance — ваш баланс\n` +
      `/pay — реквізити для оплати\n` +
      `/my — ваші спеціалісти`,
    { parse_mode: "HTML" }
  );
});

// ── Helper: get all students linked to this telegram ──────────────────────────
async function getLinkedStudents(telegramId: string) {
  return prisma.student.findMany({
    where: { telegramId },
    include: { teacher: { select: { name: true, displayName: true, paymentDetails: true } } },
    orderBy: { createdAt: "asc" },
  });
}

function specialistHeader(name: string, total: number, idx: number) {
  return total > 1 ? `👤 <b>${name}</b>\n` : "";
}

// ── Student: /balance ──────────────────────────────────────────────────────────
bot.command("balance", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const students = await getLinkedStudents(telegramId);

  if (students.length === 0) {
    await ctx.reply("❌ Ви не прив'язані. Введіть /start ВАШ_КОД");
    return;
  }

  const sections: string[] = [];
  for (const [i, student] of students.entries()) {
    const { credit, debt } = await getStudentBalance(student);

    let balanceLine: string;
    if (credit > 0) balanceLine = `✅ Баланс: +${formatAmount(credit)}`;
    else if (debt > 0) balanceLine = `🔴 Заборгованість: ${formatAmount(debt)}`;
    else balanceLine = `✅ Баланс: 0`;

    sections.push(
      specialistHeader(tName(student.teacher), students.length, i) + balanceLine
    );
  }

  await ctx.reply(`💰 <b>Баланс</b>\n\n${sections.join("\n\n")}`, { parse_mode: "HTML" });
});

// ── Student: /lessons ──────────────────────────────────────────────────────────
bot.command("lessons", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const students = await getLinkedStudents(telegramId);

  if (students.length === 0) {
    await ctx.reply("❌ Ви не прив'язані. Введіть /start ВАШ_КОД");
    return;
  }

  const today = kyivToday();
  const in30Days = kyivDateOffset(30);
  const sections: string[] = [];

  for (const [i, student] of students.entries()) {
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        isActive: true,
        date: { gte: today, lte: in30Days },
        OR: [
          { studentId: student.id },
          { isGroup: true, groupStudents: { some: { studentId: student.id } } },
        ],
      },
      orderBy: { date: "asc" },
      take: 5,
    });
    const header = specialistHeader(tName(student.teacher), students.length, i);
    if (slots.length === 0) {
      sections.push(header + "Занять немає");
      continue;
    }
    const lines = slots.map((s) => {
      const d = new Date(s.date + "T12:00:00");
      const dateLabel = d.toLocaleDateString("uk-UA", { weekday: "short", day: "numeric", month: "short" });
      return `• ${dateLabel}, ${s.startTime}–${s.endTime} ${s.isGroup ? "👥" : s.isRecurring ? "🔁" : "1️⃣"}`;
    });
    sections.push(header + lines.join("\n"));
  }

  await ctx.reply(`📅 <b>Найближчі заняття</b>\n\n${sections.join("\n\n")}`, { parse_mode: "HTML" });
});

// Teacher command: list their students
bot.command("mystudents", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const teacher = await prisma.teacher.findFirst({
    where: { telegramChatId: telegramId },
    include: { students: { where: { isArchived: false }, select: { name: true, code: true } } },
  });

  if (!teacher) {
    await ctx.reply("❌ Ви не прив'язані як спеціаліст. Введіть /start ВАШ_КОД");
    return;
  }

  if (teacher.students.length === 0) {
    await ctx.reply("У вас поки немає клієнтів.");
    return;
  }

  const lines = teacher.students.map((s) => `• ${s.name} — код <code>${s.code}</code>`);
  await ctx.reply(`👥 <b>Ваші клієнти</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
});

// ── Teacher: /today ────────────────────────────────────────────────────────────
bot.command("today", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const teacher = await prisma.teacher.findFirst({ where: { telegramChatId: telegramId } });
  if (!teacher) {
    await ctx.reply("❌ Ви не прив'язані як спеціаліст. Введіть /start ВАШ_КОД");
    return;
  }

  const today = kyivToday();
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId: teacher.id,
      isActive: true,
      date: today,
      OR: [{ studentId: { not: null } }, { isGroup: true }],
    },
    include: {
      student: { select: { name: true } },
      groupStudents: { include: { student: { select: { name: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  if (slots.length === 0) {
    await ctx.reply("📅 Сьогодні занять немає.");
    return;
  }

  const lines = slots.map((s) => {
    if (s.isGroup) {
      const names = s.groupStudents.map((gs) => gs.student.name).join(", ") || "Групове";
      return `• ${s.startTime}–${s.endTime} — 👥 ${names}`;
    }
    return `• ${s.startTime}–${s.endTime} — <b>${s.student!.name}</b>`;
  });
  await ctx.reply(`📅 <b>Заняття сьогодні</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
});

// ── Teacher: /week ─────────────────────────────────────────────────────────────
bot.command("week", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const teacher = await prisma.teacher.findFirst({ where: { telegramChatId: telegramId } });
  if (!teacher) {
    await ctx.reply("❌ Ви не прив'язані як спеціаліст. Введіть /start ВАШ_КОД");
    return;
  }

  const today = kyivToday();
  const in7Days = kyivDateOffset(6);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId: teacher.id,
      isActive: true,
      date: { gte: today, lte: in7Days },
      OR: [{ studentId: { not: null } }, { isGroup: true }],
    },
    include: {
      student: { select: { name: true } },
      groupStudents: { include: { student: { select: { name: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  if (slots.length === 0) {
    await ctx.reply("📅 На найближчі 7 днів занять немає.");
    return;
  }

  // Group by date
  const byDate = new Map<string, typeof slots>();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push(slot);
  }

  const sections: string[] = [];
  for (const [date, daySlots] of byDate) {
    const d = new Date(date + "T12:00:00");
    const dayLabel = d.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "short" });
    const lines = daySlots.map((s) => {
      if (s.isGroup) {
        const names = s.groupStudents.map((gs) => gs.student.name).join(", ") || "Групове";
        return `  • ${s.startTime}–${s.endTime} — 👥 ${names}`;
      }
      return `  • ${s.startTime}–${s.endTime} — ${s.student!.name}`;
    });
    sections.push(`<b>${dayLabel}</b>\n${lines.join("\n")}`);
  }

  await ctx.reply(`📅 <b>Заняття на 7 днів</b>\n\n${sections.join("\n\n")}`, { parse_mode: "HTML" });
});

// ── Teacher: /debts ────────────────────────────────────────────────────────────
bot.command("debts", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const teacher = await prisma.teacher.findFirst({ where: { telegramChatId: telegramId } });
  if (!teacher) {
    await ctx.reply("❌ Ви не прив'язані як спеціаліст. Введіть /start ВАШ_КОД");
    return;
  }

  const sixtyDaysAgoStr = kyivDateOffset(-60);

  const students = await prisma.student.findMany({
    where: {
      teacherId: teacher.id,
      isArchived: false,
      OR: [
        { slots: { some: { isActive: true, date: { gte: sixtyDaysAgoStr } } } },
        { groupSlots: { some: { slot: { isActive: true, date: { gte: sixtyDaysAgoStr } } } } },
      ],
    },
  });

  const debtors = (
    await Promise.all(
      students.map(async (s) => ({ name: s.name, debt: (await getStudentBalance(s)).debt }))
    )
  )
    .filter((s) => s.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  if (debtors.length === 0) {
    await ctx.reply("✅ Боргів немає!");
    return;
  }

  const lines = debtors.map((d) => `• <b>${d.name}</b> — ${formatAmount(d.debt)}`);
  await ctx.reply(`💸 <b>Клієнти з боргом</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
});

// ── Student: /next ─────────────────────────────────────────────────────────────
bot.command("next", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const students = await getLinkedStudents(telegramId);

  if (students.length === 0) {
    await ctx.reply("❌ Ви не прив'язані. Введіть /start ВАШ_КОД");
    return;
  }

  const today = kyivToday();

  // Find nearest slot across all linked specialists
  type SlotWithMeta = { date: string; startTime: string; endTime: string; specialistName: string };
  let nearest: SlotWithMeta | null = null;

  for (const student of students) {
    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        isActive: true,
        date: { gte: today },
        OR: [
          { studentId: student.id },
          { isGroup: true, groupStudents: { some: { studentId: student.id } } },
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    if (slot) {
      const candidate = { date: slot.date, startTime: slot.startTime, endTime: slot.endTime, specialistName: tName(student.teacher) };
      if (!nearest || slot.date < nearest.date || (slot.date === nearest.date && slot.startTime < nearest.startTime)) {
        nearest = candidate;
      }
    }
  }

  if (!nearest) {
    await ctx.reply("📅 Найближчих занять немає.");
    return;
  }

  const d = new Date(nearest.date + "T12:00:00");
  const dateLabel = d.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  const specialistLine = students.length > 1 ? `\n👤 ${nearest.specialistName}` : "";
  await ctx.reply(
    `📅 <b>Найближче заняття</b>\n\n${dateLabel}\n🕐 ${nearest.startTime}–${nearest.endTime}${specialistLine}`,
    { parse_mode: "HTML" }
  );
});

// ── Student: /pay ──────────────────────────────────────────────────────────────
bot.command("pay", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const students = await getLinkedStudents(telegramId);

  if (students.length === 0) {
    await ctx.reply("❌ Ви не прив'язані. Введіть /start ВАШ_КОД");
    return;
  }

  const sections: string[] = [];

  for (const [i, student] of students.entries()) {
    const request = await prisma.paymentRequest.findFirst({
      where: { studentId: student.id, fulfilledBy: null },
      orderBy: { createdAt: "asc" },
    });

    const paymentDetails = student.teacher.paymentDetails;

    if (!request && !paymentDetails) {
      sections.push(
        specialistHeader(tName(student.teacher), students.length, i) +
        "Активного запиту немає."
      );
      continue;
    }

    let section = specialistHeader(tName(student.teacher), students.length, i);

    if (request) {
      section += `Переведіть рівно: <b>${formatAmount(request.amountTotal)}</b>\n`;
      if (request.description) section += `📝 ${request.description}\n`;
      section += `⚠️ Сума має бути <b>точною</b> — за нею система вас ідентифікує.`;
    }

    if (paymentDetails) {
      section += `\n\n💼 <b>Реквізити:</b>\n${paymentDetails}`;
    }

    sections.push(section);
  }

  await ctx.reply(`💳 <b>Оплата</b>\n\n${sections.join("\n\n───\n\n")}`, { parse_mode: "HTML" });
});

// ── Student: /my ───────────────────────────────────────────────────────────────
bot.command("my", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const students = await getLinkedStudents(telegramId);

  if (students.length === 0) {
    await ctx.reply(
      "❌ Ви не прив'язані до жодного спеціаліста.\n\nВведіть /start ВАШ_КОД щоб додати."
    );
    return;
  }

  const lines = students.map((s) => `• <b>${s.teacher.name}</b> — код <code>${s.code}</code>`);
  await ctx.reply(
    `👤 <b>Ваші спеціалісти</b>\n\n${lines.join("\n")}\n\n` +
    `Щоб відв'язати спеціаліста: /unlink КОД`,
    { parse_mode: "HTML" }
  );
});

// ── Student: /unlink ───────────────────────────────────────────────────────────
bot.command("unlink", async (ctx) => {
  const telegramId = String(ctx.from!.id);
  const args = ctx.match?.trim().toUpperCase();

  if (!args) {
    await ctx.reply(
      "Вкажіть код спеціаліста:\n<b>/unlink ВАШ_КОД</b>\n\nПодивитись коди: /my",
      { parse_mode: "HTML" }
    );
    return;
  }

  const student = await prisma.student.findFirst({
    where: { code: args, telegramId },
    include: { teacher: { select: { name: true } } },
  });

  if (!student) {
    await ctx.reply("❌ Спеціаліст з таким кодом не знайдений серед ваших підписок.");
    return;
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { telegramId: null, telegramHandle: null },
  });

  await ctx.reply(
    `✅ Розклад <b>${tName(student.teacher)}</b> відв'язано. Повідомлення більше не будуть надходити.`,
    { parse_mode: "HTML" }
  );
});

// ── /support ────────────────────────────────────────────────────────────────────
// "/support <текст>" relays the inline text immediately; bare "/support" prompts
// for a separate message (which the catch-all below then relays).
bot.command("support", async (ctx) => {
  const arg = ctx.match?.trim();
  if (arg) {
    await relaySupportMessage(ctx, arg);
    return;
  }
  await ctx.reply(
    "✍️ Напишіть ваше питання одним повідомленням — і ми відповімо вам тут, у боті."
  ).catch(() => null);
});

// ── Support relay ─────────────────────────────────────────────────────────────────
// Any free-text message (from teacher, student or unknown user) is forwarded to the
// support chat. The operator replies as a Telegram reply to the forwarded message,
// and the answer is routed back via the #u<chatId> tag anchored at the message end
// (so user text containing "#u..." cannot spoof the target).
bot.on("message:text", async (ctx) => {
  const fromId = String(ctx.from!.id);
  const text = ctx.message.text;

  // 1) Operator replying from the support chat → relay the answer back to the user.
  if (SUPPORT_CHAT_ID && fromId === SUPPORT_CHAT_ID) {
    const quoted = ctx.message.reply_to_message?.text ?? "";
    const m = quoted.match(/#u(\d+)\s*$/);
    if (m) {
      await sendTelegramMessage(m[1], `💬 <b>Підтримка:</b>\n${escapeHtml(text)}`).catch(() => null);
      await ctx.reply("✅ Відповідь надіслано.").catch(() => null);
    }
    return; // the operator's own messages never become tickets
  }

  // Unknown command (e.g. /foo) — not a support message.
  if (text.startsWith("/")) return;

  // 2) Any other free-text message → forward to support.
  await relaySupportMessage(ctx, text);
});

} // end registerHandlers

export async function registerWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL;
  const secret = process.env.BOT_WEBHOOK_SECRET;
  if (!webhookUrl || !process.env.TELEGRAM_BOT_TOKEN) return;
  const b = getBot();
  await b.api.setWebhook(`${webhookUrl}/api/bot`, {
    secret_token: secret,
    drop_pending_updates: true,
  });
}
