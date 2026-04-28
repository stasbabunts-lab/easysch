import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const teacher = await prisma.teacher.findUnique({
          where: { email: credentials.email as string },
        });
        if (!teacher) return null;
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
