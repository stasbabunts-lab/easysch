import { prisma } from "./prisma";

// Same alphabet as teacher codes — no ambiguous chars (0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generate(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export async function generateUniqueStudentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate();
    const exists = await prisma.student.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique student code");
}
