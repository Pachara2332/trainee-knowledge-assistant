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
        identifier: {
          label: "Email or Username",
          type: "text",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        try {
          const identifier =
            typeof credentials.identifier === "string"
              ? credentials.identifier.trim().toLowerCase()
              : "";

          const password =
            typeof credentials.password === "string"
              ? credentials.password
              : "";

          if (!identifier || !password) {
            return null;
          }

          // MOCK ADMIN
          const mockAdminUser =
            process.env.MOCK_ADMIN_USER?.trim().toLowerCase();

          const mockAdminPassword = process.env.MOCK_ADMIN_PASSWORD;

          if (identifier === mockAdminUser && password === mockAdminPassword) {
            return {
              id: "mock-admin",
              email: "admin@example.com",
              name: "Admin",
              role: "admin",
            };
          }

          // NORMAL USER
          const user = await findUserByEmail(identifier);

          if (user && (await bcrypt.compare(password, user.password_hash))) {
            return {
              id: user.id,
              email: user.email,
              name: user.name ?? "Trainee",
              role: "user",
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
