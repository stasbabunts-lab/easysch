import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/bot/reminders";

const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID;

/** Escape user-provided text before embedding it in an HTML-parsed message. */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// POST — relay a teacher's message from the web app to the support chat.
// Mirrors the Telegram bot relay: if the teacher has linked Telegram we anchor a
// trailing #u<chatId> tag so the operator can reply (the answer is routed back to
// them in the bot). Otherwise the operator sees the teacher's name/email/phone.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Порожнє повідомлення" }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "Повідомлення задовге" }, { status: 400 });

  if (!SUPPORT_CHAT_ID) {
    return NextResponse.json(
      { error: "Підтримка тимчасово недоступна, спробуйте трохи згодом." },
      { status: 503 }
    );
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: { name: true, displayName: true, email: true, phone: true, telegramChatId: true },
  });

  const who = teacher?.displayName?.trim() || teacher?.name || "спеціаліст";
  const contactLines = [
    teacher?.email ? `✉️ ${escapeHtml(teacher.email)}` : null,
    teacher?.phone ? `📞 ${escapeHtml(teacher.phone)}` : null,
  ].filter(Boolean);

  const tail = teacher?.telegramChatId
    ? `<i>Відповідьте реплаєм на це повідомлення.</i>\n#u${teacher.telegramChatId}`
    : `<i>Telegram не підключено — зв'яжіться через контакти вище.</i>`;

  await sendTelegramMessage(
    SUPPORT_CHAT_ID,
    `📩 <b>Підтримка (сайт)</b> · спеціаліст <b>${escapeHtml(who)}</b>\n` +
      (contactLines.length ? contactLines.join("\n") + "\n" : "") +
      `\n${escapeHtml(message)}\n\n` +
      tail
  ).catch(() => null);

  return NextResponse.json({ ok: true });
}
