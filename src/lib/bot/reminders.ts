import { formatAmount } from "@/lib/payment-offset";

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function sendPaymentConfirmation(
  telegramId: string,
  amountKopecks: number,
) {
  const text = `✅ Оплату ${formatAmount(amountKopecks)} отримано! Дякуємо.`;
  await sendTelegramMessage(telegramId, text);
  return text;
}

export async function sendStudentLessonReminder(
  telegramId: string,
  scheduledAt: Date,
  minutesBefore: number,
  teacherName: string,
  isWeekly: boolean
) {
  const time = scheduledAt.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
  const date = scheduledAt.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Kyiv",
  });
  const typeLabel = isWeekly ? "щотижневе" : "разове";
  const timeLabel =
    minutesBefore >= 60
      ? `${Math.round(minutesBefore / 60)} год.`
      : `${minutesBefore} хв.`;

  const text =
    `⏰ Нагадування про заняття\n\n` +
    `📅 ${date}\n` +
    `🕐 ${time} (через ${timeLabel})\n` +
    `👤 Спеціаліст: ${teacherName}\n` +
    `🔁 Тип: ${typeLabel}`;
  await sendTelegramMessage(telegramId, text);
  return text;
}

export async function sendTeacherLessonReminder(
  chatId: string,
  scheduledAt: Date,
  minutesBefore: number,
  studentName: string,
  isWeekly: boolean
) {
  const time = scheduledAt.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
  const date = scheduledAt.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Kyiv",
  });
  const typeLabel = isWeekly ? "Щотижневе" : "Разове";
  const timeLabel =
    minutesBefore >= 60
      ? `${Math.round(minutesBefore / 60)} год.`
      : `${minutesBefore} хв.`;

  await sendTelegramMessage(
    chatId,
    `📌 <b>${typeLabel} заняття через ${timeLabel}</b>\n\n` +
      `👤 Клієнт: <b>${studentName}</b>\n` +
      `📅 ${date}\n` +
      `🕐 ${time}`
  );
}

export async function sendPostLessonPaymentReminder(
  studentTelegramId: string,
  paymentDetails: string,
  amountTotal?: number,
  postLessonNote?: string | null
) {
  const amountStr = amountTotal !== undefined ? formatAmount(amountTotal) : "—";
  let text = `Ви завершили заняття на платформі Easy Schedule, будь ласка сплатіть ${amountStr} на рахунок:\n\n`;
  text += `${paymentDetails}\n\n`;
  text += `Будь ласка сплачуйте точну суму`;
  if (postLessonNote?.trim()) text += `\n\n${postLessonNote.trim()}`;

  await sendTelegramMessage(studentTelegramId, text);
  return text;
}

export async function sendPaymentRequestNotification(
  studentTelegramId: string,
  paymentDetails: string,
  amountTotal: number,
  postLessonNote?: string | null,
  description?: string | null
) {
  const amountStr = formatAmount(amountTotal);
  let text = `💳 Запит на оплату\n\n`;
  text += `Сума до сплати: ${amountStr}\n\n`;
  if (description?.trim()) text += `📝 ${description.trim()}\n\n`;
  text += `Реквізити:\n${paymentDetails}\n\n`;
  text += `Будь ласка сплачуйте точну суму`;
  if (postLessonNote?.trim()) text += `\n\n${postLessonNote.trim()}`;
  await sendTelegramMessage(studentTelegramId, text);
  return text;
}

export async function sendTeacherPaymentNotification(
  chatId: string,
  amountKopecks: number,
  studentName: string
) {
  await sendTelegramMessage(
    chatId,
    `💰 <b>Отримано оплату</b>\n\n👤 ${studentName}\n💵 ${formatAmount(amountKopecks)}`
  );
}

// Legacy alias for compatibility
export async function sendLessonReminder(
  telegramId: string,
  scheduledAt: Date,
  studentName: string
) {
  await sendStudentLessonReminder(telegramId, scheduledAt, 60, "", true);
  void studentName;
}
