import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { AuthStatusModal } from "../../components/auth/auth-status-modal";
import { PasswordField } from "../../components/auth/password-field";
import { auth, signIn } from "../../lib/auth";
import { signInWithCredentials } from "../../lib/sign-in-credentials";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  }

  const { error, status } = await searchParams;
  const errorMessage = error ? decodeURIComponent(error) : undefined;

  return (
    <main className="assistant-grid min-h-screen overflow-hidden bg-[#151515] px-6 py-10 text-white">
      <AuthStatusModal
        status={error ? "login-error" : status}
        detail={errorMessage}
      />
      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col justify-center">
        <Link
          href="/"
          className="absolute left-0 top-0 rounded-full border border-[#333] bg-[#161616] px-4 py-2 text-sm font-semibold text-[#d6d6d6] transition hover:border-[#f4f4f4] hover:text-white"
        >
          Back to home
        </Link>
        <Link
          href="/"
          className="mb-12 text-center text-lg font-semibold tracking-tight text-[#f3f3f3]"
        >
          Knowledge Assistant
        </Link>

        <form
          className="flex flex-col gap-4"
          action={async (formData) => {
            "use server";

            try {
              await signInWithCredentials({
                email: String(formData.get("email") ?? ""),
                password: String(formData.get("password") ?? ""),
                afterLoginPath: "/chat?status=logged-in",
              });
            } catch (error) {
              unstable_rethrow(error);
              const message =
                error instanceof Error
                  ? encodeURIComponent(error.message)
                  : "Sign%20in%20failed";
              redirect(`/login?error=${message}`);
            }
          }}
        >
          <h1 className="mb-8 text-center text-4xl font-semibold tracking-tight sm:text-5xl">
            Log into your account
          </h1>

          <label className="flex flex-col gap-2 text-sm font-semibold text-[#d6d6d6]">
            Email
            <input
              className="h-14 rounded-full border border-[#333] bg-[#161616] px-5 text-base text-white outline-none transition focus:border-[#f4f4f4]"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <PasswordField autoComplete="current-password" />

          {error ? (
            <p className="rounded-2xl border border-[#7f2d2d] bg-[#2a1414] px-4 py-3 text-sm font-semibold text-[#ffb4b4]">
              {errorMessage || "Invalid email or password."}
            </p>
          ) : null}

          <button className="mt-2 h-14 rounded-full border border-[#333] bg-[#f4f4f4] px-5 text-base font-semibold text-[#151515] transition hover:bg-white cursor-pointer">
            Login with email
          </button>
        </form>

        <div className="relative my-6 flex items-center justify-center">
          <span className="absolute w-full border-t border-[#222]" />
          <span className="relative bg-[#151515] px-4 text-sm font-medium text-[#777]">
            Or continue with
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/chat?status=logged-in" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 h-14 rounded-full border border-[#2a2a2a] bg-[#111] px-5 text-base font-semibold text-[#e4e4e4] transition-all duration-300 hover:border-[#444] hover:bg-[#1a1a1a] hover:scale-[1.01] cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/chat?status=logged-in" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 h-14 rounded-full border border-[#2a2a2a] bg-[#111] px-5 text-base font-semibold text-[#e4e4e4] transition-all duration-300 hover:border-[#444] hover:bg-[#1a1a1a] hover:scale-[1.01] cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                />
              </svg>
              <span>GitHub</span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("line", { redirectTo: "/chat?status=logged-in" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 h-14 rounded-full border border-[#1b3d26] bg-[#0c1f13] px-5 text-base font-semibold text-[#a3e6b7] transition-all duration-300 hover:border-[#2d663f] hover:bg-[#122e1d] hover:scale-[1.01] cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 10.3c0-4.75-5.38-8.61-12-8.61S0 5.55 0 10.3c0 4.25 4.28 7.82 10.07 8.5a.65.65 0 0 1 .46.33l.19.82c.11.45.05.9-.13 1.28-.15.3-.43.51-.78.58-.29.06-.32.22-.07.39.2.14.54.34.88.34a2.23 2.23 0 0 0 2.22-1.89l.3-1.86a.54.54 0 0 1 .37-.43c5.68-.8 10.01-4.36 10.01-8.58zM6.9 13.08a.38.38 0 0 1-.38.38H4.21a.38.38 0 0 1-.38-.38V7.52a.38.38 0 0 1 .38-.38h.42a.38.38 0 0 1 .38.38v.38zm1.88 0a.38.38 0 0 1-.38.38h-.42a.38.38 0 0 1-.38-.38V7.52a.38.38 0 0 1 .38-.38h.42a.38.38 0 0 1 .38.38v5.56zm5.82 0a.38.38 0 0 1-.38.38h-.46a.39.39 0 0 1-.32-.16l-2.07-2.92v2.7a.38.38 0 0 1-.38.38h-.42a.38.38 0 0 1-.38-.38V7.52a.38.38 0 0 1 .38-.38h.46c.13 0 .25.06.32.16l2.07 2.92v-2.7a.38.38 0 0 1 .38-.38h.42a.38.38 0 0 1 .38.38v5.56zm4.18-2.61h-1.49v1.23h1.49a.38.38 0 0 1 .38.38v.38a.38.38 0 0 1-.38.38H15.4a.38.38 0 0 1-.38-.38V7.52a.38.38 0 0 1 .38-.38h2.3a.38.38 0 0 1 .38.38v.38a.38.38 0 0 1-.38.38h-1.49v1.17h1.49a.38.38 0 0 1 .38.38v.38a.38.38 0 0 1-.38.39z" />
              </svg>
              <span>LINE</span>
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-base text-[#b8b8b8]">
          Don&apos;t have an account?{" "}
          <Link className="font-semibold text-white" href="/register">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
