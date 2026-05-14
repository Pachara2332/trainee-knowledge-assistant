import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  }

  const { error } = await searchParams;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] px-6 py-12 text-white">
      <div className="pointer-events-none fixed inset-0 hero-noise opacity-70" />
      <div className="pointer-events-none fixed inset-0 hero-halftone opacity-35" />
      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Link
            href="/"
            className="mb-8 inline-block border-4 border-[#111111] bg-[#FBB829] px-3 py-2 text-xl font-black uppercase tracking-tighter text-[#111111] shadow-[6px_6px_0_#B91C1C]"
          >
            Knowledge Assistant
          </Link>
          <p className="mb-4 inline-block -skew-x-6 bg-[#2986CC] px-3 py-1 text-sm font-black uppercase tracking-[0.28em] text-white shadow-[6px_6px_0_#111111]">
            Console Access
          </p>
          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.85] text-[#FBB829] drop-shadow-[8px_8px_0_#111111] sm:text-8xl">
            Back In The Fight
          </h1>
          <p className="mt-6 max-w-lg text-lg font-semibold leading-8 text-[#E5E7EB]">
            Sign in to reopen your chat console and continue the knowledge
            mission.
          </p>
        </div>

        <form
          className="relative flex flex-col gap-4 border-4 border-[#111111] bg-white p-6 text-[#111111] shadow-[16px_16px_0_#2986CC]"
          action={async (formData) => {
            "use server";

            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/chat",
              });
            } catch (error) {
              if (error instanceof AuthError) {
                redirect("/login?error=CredentialsSignin");
              }

              throw error;
            }
          }}
        >
          <div className="absolute -right-4 -top-4 bg-[#B91C1C] px-4 py-2 text-sm font-black uppercase tracking-widest text-white shadow-[6px_6px_0_#111111]">
            Login
          </div>
          <h2 className="text-4xl font-black uppercase leading-none">Identify</h2>

          <label className="flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Email
            <input
              className="h-12 border-2 border-[#111111] bg-[#E5E7EB] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#2986CC]"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Password
            <input
              className="h-12 border-2 border-[#111111] bg-[#E5E7EB] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#2986CC]"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="border-2 border-[#B91C1C] bg-red-50 px-3 py-2 text-sm font-bold text-[#B91C1C]">
              Invalid email or password.
            </p>
          ) : null}

          <button className="mt-2 bg-[#FBB829] px-5 py-4 text-lg font-black uppercase tracking-wider text-[#111111] shadow-[8px_8px_0_#111111] transition hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_#111111]">
            Sign in
          </button>
          <p className="text-center text-sm font-semibold">
            Need clearance?{" "}
            <Link className="font-black text-[#B91C1C] underline" href="/register">
              Create account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
