import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH: add days to subscription, or set specific date
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { addDays, setDate } = await req.json();

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let newExpiry: Date;

  if (setDate) {
    newExpiry = new Date(setDate);
  } else if (addDays) {
    const base = teacher.subscriptionExpiresAt && teacher.subscriptionExpiresAt > new Date()
      ? teacher.subscriptionExpiresAt
      : new Date();
    newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + Number(addDays));
  } else {
    return NextResponse.json({ error: "addDays or setDate required" }, { status: 400 });
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: { subscriptionExpiresAt: newExpiry },
    select: { id: true, name: true, subscriptionExpiresAt: true },
  });

  return NextResponse.json(updated);
}

// DELETE: revoke subscription immediately
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const updated = await prisma.teacher.update({
    where: { id },
    data: { subscriptionExpiresAt: new Date() }, // set to now = expired
    select: { id: true, name: true, subscriptionExpiresAt: true },
  });
  return NextResponse.json(updated);
}
