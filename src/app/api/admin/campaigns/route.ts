import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9-]+$/;

// GET: list campaigns with click + signup stats
export async function GET() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });

  const grouped = await prisma.teacher.groupBy({
    by: ["referralSlug"],
    where: { referralSlug: { not: null } },
    _count: { _all: true },
  });
  const signupsBySlug = new Map(grouped.map((g) => [g.referralSlug, g._count._all]));

  return NextResponse.json(
    campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.label,
      clicks: c.clicks,
      signups: signupsBySlug.get(c.slug) ?? 0,
      createdAt: c.createdAt,
    }))
  );
}

// POST: create a campaign
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const label = String(body.label ?? "").trim();

  if (!slug || !label)
    return NextResponse.json({ error: "Назва та мітка обов'язкові" }, { status: 400 });
  if (!SLUG_RE.test(slug))
    return NextResponse.json({ error: "Мітка: лише a-z, 0-9 та дефіс" }, { status: 400 });
  if (await prisma.campaign.findUnique({ where: { slug } }))
    return NextResponse.json({ error: "Така мітка вже існує" }, { status: 409 });

  const c = await prisma.campaign.create({ data: { slug, label } });
  return NextResponse.json(
    { id: c.id, slug: c.slug, label: c.label, clicks: 0, signups: 0, createdAt: c.createdAt },
    { status: 201 }
  );
}
