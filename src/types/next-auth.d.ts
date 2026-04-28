import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      teacherCode: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    teacherId: string;
    teacherCode: string;
  }
}
