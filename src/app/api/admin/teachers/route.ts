import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return token && verifyAdminToken(token);
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
