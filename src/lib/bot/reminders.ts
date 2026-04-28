import { formatAmount } from "@/lib/payment-offset";

async function sendTelegramMessage(chatId: string, text: string) {
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
  studentName: string
) {
  await sendTelegramMessage(
    telegramId,
    `✅ Оплату ${formatAmount(amountKopecks)} отримано! Дякуємо, ${studentName}.`
  );
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

  await sendTelegramMessage(
    telegramId,
    `⏰ <b>Нагадування про заняття</b>\n\n` +
      `📅 ${date}\n` +
      `🕐 ${time} (через ${timeLabel})\n` +
      `👤 Спеціаліст: ${teacherName}\n` +
      `🔁 Тип: ${typeLabel}`
  );
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
  description?: string | null
) {
  let text = `📚 <b>Заняття завершено!</b>\n\n`;

  if (amountTotal !== undefined) {
    text += `Переведіть рівно: <b>${formatAmount(amountTotal)}</b>\n`;
    if (description) text += `📝 ${description}\n`;
    text += `\n⚠️ Сума має бути <b>точною</b> — за нею система вас ідентифікує.\n`;
  }

  text += `\n💼 <b>Реквізити:</b>\n${paymentDetails}`;

  await sendTelegramMessage(studentTelegramId, text);
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
