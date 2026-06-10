import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MonobankAdapter } from "@/lib/bank/monobank-adapter";

// Simple in-memory debounce to respect Monobank 60s rate limit
const lastPollTime = new Map<string, number>();
const POLL_INTERVAL_MS = 30_000;

async function pollAdminBank(paymentId: string, offset: number, createdAt: Date): Promise<boolean> {
  const now = Date.now();
  const last = lastPollTime.get(paymentId) ?? 0;
  if (now - last < POLL_INTERVAL_MS) return false;
  lastPollTime.set(paymentId, now);

  const [tokenRow, cardRow] = await Promise.all([
    prisma.appSettings.findUnique({ where: { key: "subscription_monobank_token" } }),
    prisma.appSettings.findUnique({ where: { key: "subscription_card_number" } }),
  ]);
  if (!tokenRow?.value) return false;

  try {
    // Pass the configured card so only payments to THAT card count as site
    // subscription payments (the same token may cover other cards used elsewhere).
    const adapter = new MonobankAdapter(tokenRow.value, cardRow?.value || undefined);
    const txs = await adapter.getIncomingTransactions(createdAt);

    for (const tx of txs) {
      const txOffset = tx.amount >= 1000 ? tx.amount % 1000 : tx.amount % 100;
      if (txOffset === offset) return true;
    }
  } catch {
    // Monobank error — silently skip
  }

  return false;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const payment = await prisma.subscriptionPayment.findUnique({ where: { id } });
  if (!payment || payment.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status === "CONFIRMED") {
    return NextResponse.json({ status: "CONFIRMED" });
  }

  // Expire stale payments
  if (payment.expiresAt < new Date()) {
    if (payment.status !== "EXPIRED") {
      await prisma.subscriptionPayment.update({ where: { id }, data: { status: "EXPIRED" } });
    }
    return NextResponse.json({ status: "EXPIRED" });
  }

  // Poll admin bank
  const found = await pollAdminBank(id, payment.offset, payment.createdAt);
  if (found) {
    // Confirm payment and extend subscription
    const teacher = await prisma.teacher.findUnique({
      where: { id: payment.teacherId },
      select: { subscriptionExpiresAt: true },
    });
    const base = teacher?.subscriptionExpiresAt && teacher.subscriptionExpiresAt > new Date()
      ? teacher.subscriptionExpiresAt
      : new Date();
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + payment.addDays);

    await prisma.$transaction([
      prisma.subscriptionPayment.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      }),
      prisma.teacher.update({
        where: { id: payment.teacherId },
        data: { subscriptionExpiresAt: newExpiry },
      }),
    ]);

    lastPollTime.delete(id);
    return NextResponse.json({ status: "CONFIRMED" });
  }

  const cardRow = await prisma.appSettings.findUnique({ where: { key: "subscription_card_number" } });
  const telegramRow = await prisma.appSettings.findUnique({ where: { key: "subscription_telegram" } });

  return NextResponse.json({
    status: "PENDING",
    amountTotal: payment.amountTotal,
    cardNumber: cardRow?.value ?? "",
    telegramLink: telegramRow?.value ?? "https://t.me/EasySchBot",
    expiresAt: payment.expiresAt,
  });
}
