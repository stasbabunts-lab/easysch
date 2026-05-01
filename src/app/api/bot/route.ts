import { NextRequest, NextResponse } from "next/server";
import { bot as getBot } from "@/lib/bot/bot";
import { webhookCallback } from "grammy";

export async function POST(req: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.BOT_WEBHOOK_SECRET && secret !== process.env.BOT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bot = getBot();
  const handler = webhookCallback(bot, "std/http");
  return handler(req);
}
