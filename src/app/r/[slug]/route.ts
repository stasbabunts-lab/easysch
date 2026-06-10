import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Link-preview crawlers (Telegram/Facebook/etc.) fetch the URL without being a
// real visitor — don't count those as clicks.
const BOT_UA =
  /bot|crawl|spider|preview|facebookexternalhit|telegram|whatsapp|viber|slack|discord|vkshare|skype|googlebot|bingbot|yandex/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const res = NextResponse.redirect(new URL("/", req.url));

  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign) return res; // unknown ref — just send them home

  const ua = req.headers.get("user-agent") ?? "";
  if (!BOT_UA.test(ua)) {
    await prisma.campaign
      .update({ where: { id: campaign.id }, data: { clicks: { increment: 1 } } })
      .catch(() => null);
  }

  // Remember the source for 30 days so a later signup is attributed to it.
  res.cookies.set("esch_ref", slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}
