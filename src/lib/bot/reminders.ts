import { formatAmount } from "@/lib/payment-offset";
import { resolveLessonNoun, adj, cap } from "@/lib/lesson-noun";

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
  isWeekly: boolean,
  lessonNoun?: string | null
) {
  const noun = resolveLessonNoun(lessonNoun);
  const time = scheduledAt.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC", // scheduledAt holds wall-clock time stored as UTC — echo it back, don't shift
  });
  const date = scheduledAt.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC", // scheduledAt holds wall-clock time stored as UTC — echo it back, don't shift
  });
  const typeLabel = isWeekly ? adj("weekly", noun) : adj("oneTime", noun);
  const timeLabel =
    minutesBefore >= 60
      ? `${Math.round(minutesBefore / 60)} год.`
      : `${minutesBefore} хв.`;

  const text =
    `⏰ Нагадування про ${noun.acc}\n\n` +
    `📅 ${date}\n` +
    `🕐 ${time} за київським часом (через ${timeLabel})\n` +
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
  isWeekly: boolean,
  lessonNoun?: string | null
) {
  const noun = resolveLessonNoun(lessonNoun);
  const time = scheduledAt.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC", // scheduledAt holds wall-clock time stored as UTC — echo it back, don't shift
  });
  const date = scheduledAt.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC", // scheduledAt holds wall-clock time stored as UTC — echo it back, don't shift
  });
  const typeLabel = cap(isWeekly ? adj("weekly", noun) : adj("oneTime", noun));
  const timeLabel =
    minutesBefore >= 60
      ? `${Math.round(minutesBefore / 60)} год.`
      : `${minutesBefore} хв.`;

  await sendTelegramMessage(
    chatId,
    `📌 <b>${typeLabel} ${noun.nom} через ${timeLabel}</b>\n\n` +
      `👤 Клієнт: <b>${studentName}</b>\n` +
      `📅 ${date}\n` +
      `🕐 ${time}`
  );
}

export async function sendPostLessonPaymentReminder(
  studentTelegramId: string,
  paymentDetails: string,
  amountTotal: number,
  postLessonNote?: string | null,
  requireExactSum: boolean = false,
  lessonNoun?: string | null
) {
  const noun = resolveLessonNoun(lessonNoun);
  const amountStr = formatAmount(amountTotal);
  const parts = [
    `Ви завершили ${noun.acc} на платформі Easy Schedule, будь ласка, сплатіть ${amountStr} на рахунок:\n\n${paymentDetails}`,
  ];
  // The "exact sum" ask only matters when a bank API auto-matches by the kopeck tail.
  if (requireExactSum) parts.push(`Будь ласка, сплачуйте точну суму, щоб система могла розпізнати ваш платіж`);
  if (postLessonNote?.trim()) parts.push(postLessonNote.trim());

  const text = parts.join("\n\n");
  await sendTelegramMessage(studentTelegramId, text);
  return text;
}

export async function sendPaymentRequestNotification(
  studentTelegramId: string,
  paymentDetails: string,
  amountTotal: number,
  postLessonNote?: string | null,
  description?: string | null,
  requireExactSum: boolean = false
) {
  const amountStr = formatAmount(amountTotal);
  const parts = [`💳 Запит на оплату`, `Сума до сплати: ${amountStr}`];
  if (description?.trim()) parts.push(`📝 ${description.trim()}`);
  parts.push(`Реквізити:\n${paymentDetails}`);
  // The "exact sum" ask only matters when a bank API auto-matches by the kopeck tail.
  if (requireExactSum) parts.push(`Будь ласка, сплачуйте точну суму, щоб система могла розпізнати ваш платіж`);
  if (postLessonNote?.trim()) parts.push(postLessonNote.trim());

  const text = parts.join("\n\n");
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
