import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function own(id: string, teacherId: string) {
  return prisma.bankAccount.findFirst({ where: { id, teacherId } });
}

// PATCH: toggle isActive or update label/creds
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await own(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { isActive, label, creds } = await req.json();

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(label !== undefined && { label: String(label).trim() }),
      ...(creds && typeof creds === "object" && { creds: JSON.stringify(creds) }),
    },
    select: { id: true, bankType: true, label: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

// DELETE: remove account
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await own(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
