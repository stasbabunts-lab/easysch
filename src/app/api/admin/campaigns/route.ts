import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9-]+$/;

// GET: list campaigns with click + signup stats
export async function GET() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });

  // Pull each attributed teacher with how many students / payments they have, so we
  // can measure activation per campaign (not just raw signups).
  const teachers = await prisma.teacher.findMany({
    where: { referralSlug: { not: null } },
    select: {
      referralSlug: true,
      _count: { select: { students: true, payments: true } },
    },
  });

  type Stat = { signups: number; activated: number; paid: number };
  const statsBySlug = new Map<string, Stat>();
  for (const t of teachers) {
    const slug = t.referralSlug!;
    const s = statsBySlug.get(slug) ?? { signups: 0, activated: 0, paid: 0 };
    s.signups += 1;
    if (t._count.students > 0) s.activated += 1; // added at least one student
    if (t._count.payments > 0) s.paid += 1; // received at least one payment
    statsBySlug.set(slug, s);
  }

  return NextResponse.json(
    campaigns.map((c) => {
      const s = statsBySlug.get(c.slug) ?? { signups: 0, activated: 0, paid: 0 };
      return {
        id: c.id,
        slug: c.slug,
        label: c.label,
        clicks: c.clicks,
        signups: s.signups,
        activated: s.activated,
        paid: s.paid,
        createdAt: c.createdAt,
      };
    })
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
    { id: c.id, slug: c.slug, label: c.label, clicks: 0, signups: 0, activated: 0, paid: 0, createdAt: c.createdAt },
    { status: 201 }
  );
}
