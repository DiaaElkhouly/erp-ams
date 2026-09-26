import type { NextAuthConfig } from "next-auth";

// Edge-safe config used by middleware (no Prisma/bcrypt here).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = !nextUrl.pathname.startsWith("/login") &&
        !nextUrl.pathname.startsWith("/forgot-password") &&
        !nextUrl.pathname.startsWith("/reset-password") &&
        !nextUrl.pathname.startsWith("/api/auth");
      if (isOnDashboard) {
        return isLoggedIn;
      }
      if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  providers: [], // populated in auth.ts
} satisfies NextAuthConfig;
