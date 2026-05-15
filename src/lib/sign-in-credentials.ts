import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "./auth";

function getAppOrigin() {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function assertAuthEnv() {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "เซิร์ฟเวอร์ยังไม่มี AUTH_SECRET หรือ NEXTAUTH_SECRET ใน .env — ใส่ค่าแล้วรีสตาร์ท Docker",
    );
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "เซิร์ฟเวอร์ยังไม่มี DATABASE_URL ใน .env — ใส่ connection string ของ Neon แล้วรีสตาร์ท",
    );
  }
}

/**
 * ล็อกอินแบบ credentials จาก Server Action (ไม่เปิดหน้า GET /api/auth/callback/credentials)
 */
export async function signInWithCredentials({
  email,
  password,
  afterLoginPath = "/chat",
  onErrorPath = "/login",
}: {
  email: string;
  password: string;
  afterLoginPath?: string;
  onErrorPath?: string;
}) {
  assertAuthEnv();

  const callbackUrl = `${getAppOrigin()}${afterLoginPath.startsWith("/") ? afterLoginPath : `/${afterLoginPath}`}`;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`${onErrorPath}?error=CredentialsSignin`);
    }

    throw error;
  }

  redirect(afterLoginPath);
}
