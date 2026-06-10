import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  subscription_price_kopecks: "15000",
  subscription_period_days: "30",
  subscription_card_number: "",
  subscription_monobank_token: "",
  subscription_telegram: "https://t.me/EasySchBot",
};

export async function GET() {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.appSettings.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;

  // never expose the token
  const { subscription_monobank_token: _, ...safe } = map;
  const hasToken = !!map.subscription_monobank_token;

  return NextResponse.json({ ...safe, subscription_monobank_token_set: hasToken });
}

export async function PUT(req: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    "subscription_price_kopecks",
    "subscription_period_days",
    "subscription_card_number",
    "subscription_monobank_token",
    "subscription_telegram",
  ];

  for (const key of allowed) {
    if (key in body && body[key] !== undefined) {
      // skip empty token update (keep existing)
      if (key === "subscription_monobank_token" && body[key] === "") continue;
      await prisma.appSettings.upsert({
        where: { key },
        update: { value: String(body[key]) },
        create: { key, value: String(body[key]) },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
