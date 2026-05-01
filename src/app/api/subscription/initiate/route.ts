import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSettings() {
  const rows = await prisma.appSettings.findMany({
    where: { key: { in: ["subscription_price_kopecks", "subscription_period_days", "subscription_card_number"] } },
  });
  const map: Record<string, string> = {
    subscription_price_kopecks: "8000",
    subscription_period_days: "30",
    subscription_card_number: "",
  };
  for (const row of rows) map[row.key] = row.value;
  return {
    priceKopecks: parseInt(map.subscription_price_kopecks) || 8000,
    periodDays: parseInt(map.subscription_period_days) || 30,
    cardNumber: map.subscription_card_number,
  };
}

function assignOffset(usedOffsets: Set<number>): number {
  for (let i = 1; i <= 99; i++) {
    if (i === 100) continue;
    if (!usedOffsets.has(i)) return i;
  }
  for (let i = 101; i <= 999; i++) {
    if (!usedOffsets.has(i)) return i;
  }
  return 1;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacherId = session.user.id;
  const { amountKopecks } = await req.json().catch(() => ({}));

  const settings = await getSettings();

  // Determine amount and days
  const baseAmount = amountKopecks && amountKopecks > 0
    ? Math.round(amountKopecks)
    : settings.priceKopecks;

  // Return existing PENDING payment only if the amount matches
  const existing = await prisma.subscriptionPayment.findFirst({
    where: { teacherId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing && existing.amountBase === baseAmount) {
    return NextResponse.json({
      id: existing.id,
      amountTotal: existing.amountTotal,
      offset: existing.offset,
      cardNumber: settings.cardNumber,
      expiresAt: existing.expiresAt,
    });
  }
  // Amount changed — expire the old payment and create a new one
  if (existing) {
    await prisma.subscriptionPayment.update({
      where: { id: existing.id },
      data: { status: "EXPIRED" },
    });
  }
  const addDays = Math.max(1, Math.floor(baseAmount / settings.priceKopecks) * settings.periodDays);

  // Assign unique offset
  const pending = await prisma.subscriptionPayment.findMany({
    where: { status: "PENDING", expiresAt: { gt: new Date() } },
    select: { offset: true },
  });
  const usedOffsets = new Set(pending.map((p) => p.offset));
  const offset = assignOffset(usedOffsets);

  const amountTotal = baseAmount + offset;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const payment = await prisma.subscriptionPayment.create({
    data: {
      teacherId,
      amountBase: baseAmount,
      amountTotal,
      offset,
      addDays,
      expiresAt,
    },
  });

  return NextResponse.json({
    id: payment.id,
    amountTotal: payment.amountTotal,
    offset: payment.offset,
    cardNumber: settings.cardNumber,
    expiresAt: payment.expiresAt,
  });
}
