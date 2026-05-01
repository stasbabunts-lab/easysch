import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS = {
  subscription_price_kopecks: "8000",
  subscription_period_days: "30",
  subscription_card_number: "",
};

export async function GET() {
  const rows = await prisma.appSettings.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;

  return NextResponse.json({
    priceKopecks: parseInt(map.subscription_price_kopecks) || 8000,
    periodDays: parseInt(map.subscription_period_days) || 30,
    cardNumber: map.subscription_card_number,
  });
}
