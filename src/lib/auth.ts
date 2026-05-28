import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Line from "next-auth/providers/line";
import { findUserByEmail, createOAuthUser } from "./users";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  trustHost: true,
  secret:
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider && account.provider !== "credentials") {
        let email = user.email;
        if (!email) {
          email = `${account.provider}_${account.providerAccountId}@oauth.local`;
          user.email = email;
        }

        try {
          let dbUser = await findUserByEmail(email);
          if (!dbUser) {
            dbUser = await createOAuthUser({
              email,
              name: user.name ?? undefined,
            });
          }
          if (dbUser) {
            user.id = dbUser.id;
          } else {
            return false;
          }
        } catch (error) {
          console.error("[auth] signIn callback failed", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account && account.provider !== "credentials") {
          let email = user.email;
          if (!email) {
            email = `${account.provider}_${account.providerAccountId}@oauth.local`;
          }
          const dbUser = await findUserByEmail(email);
          if (dbUser) {
            token.id = dbUser.id;
          }
        } else if (user.id) {
          token.id = user.id;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        (session.user as { id?: string }).id = token.id;
      }

      return session;
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Line({
      clientId: process.env.AUTH_LINE_ID,
      clientSecret: process.env.AUTH_LINE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email =
            typeof credentials.email === "string"
              ? credentials.email.trim().toLowerCase()
              : "";
          const password =
            typeof credentials.password === "string" ? credentials.password : "";

          if (!email || !password) {
            return null;
          }

          const user = await findUserByEmail(email);

          if (user && user.password_hash && (await bcrypt.compare(password, user.password_hash))) {
            return {
              id: user.id,
              email: user.email,
              name: user.name ?? "Trainee",
            };
          }

          return null;
        } catch (error) {
          console.error("[auth] authorize failed", error);
          return null;
        }
      },
    }),
  ],
});
