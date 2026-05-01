import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { generateUniqueTeacherCode } from "./teacher-code";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // ── Email + Password ──────────────────────────────────────────────────
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const teacher = await prisma.teacher.findUnique({
          where: { email: credentials.email as string },
        });
        if (!teacher || !teacher.passwordHash) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          teacher.passwordHash
        );
        if (!valid) return null;
        return {
          id: teacher.id,
          email: teacher.email,
          name: teacher.name,
          teacherCode: teacher.code,
        };
      },
    }),

    // ── Google via Firebase ID token ──────────────────────────────────────
    Credentials({
      id: "firebase-google",
      credentials: {
        firebaseToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.firebaseToken) return null;

        // Lazy import — firebase-admin must only run server-side
        const { adminAuth } = await import("./firebase/admin");

        let decoded;
        try {
          decoded = await adminAuth.verifyIdToken(credentials.firebaseToken as string);
        } catch {
          return null;
        }

        const { email, name, uid } = decoded;
        if (!email) return null;

        // Find or create teacher
        let teacher = await prisma.teacher.findUnique({ where: { email } });

        if (!teacher) {
          const code = await generateUniqueTeacherCode();
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 14);
          teacher = await prisma.teacher.create({
            data: {
              email,
              name: name || email.split("@")[0],
              passwordHash: `GOOGLE:${uid}`, // marker — no password login possible
              code,
              subscriptionExpiresAt: trialEnd,
            },
          });
        }

        return {
          id: teacher.id,
          email: teacher.email,
          name: teacher.name,
          teacherCode: teacher.code,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.teacherId = user.id;
        token.teacherCode = (user as { teacherCode?: string }).teacherCode;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.teacherId as string;
      session.user.teacherCode = token.teacherCode as string;
      return session;
    },
  },
});
