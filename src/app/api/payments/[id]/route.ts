import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/payments/:id — toggle isIgnored (or update notes)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const payment = await prisma.payment.findFirst({
    where: { id, teacherId: session.user.id },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      ...(body.isIgnored !== undefined && { isIgnored: Boolean(body.isIgnored) }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
    },
    include: { student: { select: { name: true, paymentOffset: true } } },
  });

  return NextResponse.json(updated);
}
