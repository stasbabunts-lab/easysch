import { NextRequest, NextResponse } from "next/server";
import { bot, registerWebhook } from "@/lib/bot/bot";
import { webhookCallback } from "grammy";

let webhookRegistered = false;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.BOT_WEBHOOK_SECRET && secret !== process.env.BOT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!webhookRegistered && process.env.WEBHOOK_URL) {
    await registerWebhook();
    webhookRegistered = true;
  }

  const handler = webhookCallback(bot, "std/http");
  return handler(req);
}
