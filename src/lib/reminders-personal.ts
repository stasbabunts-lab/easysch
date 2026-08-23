import { prisma } from "./prisma";
import { sendTelegramMessage } from "./bot/reminders";
import { splitTimes } from "./daily-reminder";
import { kyivNow } from "./time";

// Escape the few chars Telegram's HTML parse_mode treats as markup, so free-text
// reminders never break the message.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Deliver personal reminders whose time has arrived. Called from the 5-min cron,
// so granularity is ~5 min. remindAt is Kyiv wall-clock-as-UTC, so it is compared
// against kyivNow() (not real UTC). Fully decoupled from payment polling — a
// failure here never affects the rest of the cron run.
export async function dispatchDueReminders(): Promise<number> {
  const now = kyivNow();

  const due = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: now } },
    include: { teacher: { select: { telegramChatId: true } } },
    orderBy: { remindAt: "asc" },
  });

  let sent = 0;
  for (const r of due) {
    // No linked Telegram yet — leave it pending so it delivers once they connect.
    if (!r.teacher.telegramChatId) continue;

    await sendTelegramMessage(
      r.teacher.telegramChatId,
      `🔔 <b>Нагадування</b>\n\n${escapeHtml(r.text)}`
    ).catch(() => null);

    await prisma.reminder.update({ where: { id: r.id }, data: { sent: true } });
    sent++;
  }

  return sent;
}

// How late a slot may still be delivered. The cron runs every 5 min; anything
// older than this was missed while the app was down and is dropped rather than
// fired hours late (but it is still marked, so it never fires again).
const DAILY_GRACE_MS = 30 * 60 * 1000;

// Deliver recurring daily reminders. Each rule holds one text and several Kyiv
// wall-clock times; `lastSentAt` is the slot last handled, so every slot fires
// once a day. At most one message per rule per cron run — if several slots came
// due at once (downtime), only the freshest is worth sending.
export async function dispatchDailyReminders(): Promise<number> {
  const now = kyivNow();
  const today = now.toISOString().slice(0, 10);

  const rules = await prisma.dailyReminder.findMany({
    where: { isActive: true },
    include: { teacher: { select: { telegramChatId: true } } },
  });

  let sent = 0;
  for (const rule of rules) {
    // No linked Telegram yet — leave the rule untouched so it starts once they connect.
    if (!rule.teacher.telegramChatId) continue;

    let latestDue: Date | null = null;
    let toSend: Date | null = null;
    for (const time of splitTimes(rule.times)) {
      const at = new Date(`${today}T${time}:00Z`);
      if (isNaN(at.getTime()) || at > now) continue;
      latestDue = at;
      if (rule.lastSentAt && at <= rule.lastSentAt) continue;
      if (now.getTime() - at.getTime() <= DAILY_GRACE_MS) toSend = at;
    }
    if (!latestDue) continue;

    if (toSend) {
      await sendTelegramMessage(
        rule.teacher.telegramChatId,
        `🔔 <b>Нагадування</b>\n\n${escapeHtml(rule.text)}`
      ).catch(() => null);
      sent++;
    }

    // Mark even skipped slots as handled — a missed 14:00 must not fire at 19:00.
    await prisma.dailyReminder.update({
      where: { id: rule.id },
      data: { lastSentAt: latestDue },
    });
  }

  return sent;
}
