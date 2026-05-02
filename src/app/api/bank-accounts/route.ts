import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

// GET: list bank accounts (creds never returned)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.bankAccount.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      bankType: true,
      label: true,
      isActive: true,
      createdAt: true,
      // creds intentionally excluded
    },
  });

  return NextResponse.json(accounts);
}

// POST: add a new bank account
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bankType, label, creds } = await req.json();
  if (!bankType || !label || !creds || typeof creds !== "object") {
    return NextResponse.json({ error: "bankType, label та creds обов'язкові" }, { status: 400 });
  }

  const account = await prisma.bankAccount.create({
    data: {
      teacherId: session.user.id,
      bankType,
      label: label.trim(),
      creds: encrypt(JSON.stringify(creds)),
      isActive: true,
    },
    select: { id: true, bankType: true, label: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(account, { status: 201 });
}
