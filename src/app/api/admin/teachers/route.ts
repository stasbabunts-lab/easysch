import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  void req;
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      createdAt: true,
      subscriptionExpiresAt: true,
      telegramChatId: true,
      _count: { select: { students: true, lessons: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(teachers);
}
