import { prisma } from "./prisma";
import { sendTelegramMessage } from "./bot/reminders";
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
