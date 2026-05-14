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
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        const expectedEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();

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

        const expectedPasswordHash = process.env.AUTH_PASSWORD_HASH;
        const passwordMatches = expectedPasswordHash
          ? await bcrypt.compare(password, expectedPasswordHash)
          : false;

        if (email === expectedEmail && passwordMatches) {
          return {
            id: email,
            email,
            name: "Trainee",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
