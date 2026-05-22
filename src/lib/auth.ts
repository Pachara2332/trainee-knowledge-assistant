import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "./users";

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
  providers: [
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

          if (user && (await bcrypt.compare(password, user.password_hash))) {
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
