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
    <main className="min-h-screen overflow-hidden bg-[#18202B] px-6 py-12 text-white">
      <div className="pointer-events-none fixed inset-0 hero-noise opacity-70" />
      <div className="pointer-events-none fixed inset-0 hero-halftone opacity-35" />
      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Link
            href="/"
            className="mb-8 inline-block border-4 border-[#1C1B1A] bg-[#C89B3C] px-3 py-2 text-xl font-black uppercase tracking-tighter text-[#1C1B1A] shadow-[6px_6px_0_#8E3A3A]"
          >
            Knowledge Assistant
          </Link>
          <p className="mb-4 inline-block -skew-x-6 bg-[#4F6F86] px-3 py-1 text-sm font-black uppercase tracking-[0.28em] text-white shadow-[6px_6px_0_#1C1B1A]">
            Console Access
          </p>
          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.85] text-[#C89B3C] drop-shadow-[8px_8px_0_#1C1B1A] sm:text-8xl">
            Back In The Fight
          </h1>
          <p className="mt-6 max-w-lg text-lg font-semibold leading-8 text-[#E7E1D6]">
            Sign in to reopen your chat console and continue the knowledge
            mission.
          </p>
        </div>

        <form
          className="relative flex flex-col gap-4 border-4 border-[#1C1B1A] bg-white p-6 text-[#1C1B1A] shadow-[16px_16px_0_#4F6F86]"
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
          <div className="absolute -right-4 -top-4 bg-[#8E3A3A] px-4 py-2 text-sm font-black uppercase tracking-widest text-white shadow-[6px_6px_0_#1C1B1A]">
            Login
          </div>
          <h2 className="text-4xl font-black uppercase leading-none">Identify</h2>

          <label className="flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Email
            <input
              className="h-12 border-2 border-[#1C1B1A] bg-[#E7E1D6] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#4F6F86]"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Password
            <input
              className="h-12 border-2 border-[#1C1B1A] bg-[#E7E1D6] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#4F6F86]"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="border-2 border-[#8E3A3A] bg-red-50 px-3 py-2 text-sm font-bold text-[#8E3A3A]">
              Invalid email or password.
            </p>
          ) : null}

          <button className="mt-2 bg-[#C89B3C] px-5 py-4 text-lg font-black uppercase tracking-wider text-[#1C1B1A] shadow-[8px_8px_0_#1C1B1A] transition hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_#1C1B1A]">
            Sign in
          </button>
          <p className="text-center text-sm font-semibold">
            Need clearance?{" "}
            <Link className="font-black text-[#8E3A3A] underline" href="/register">
              Create account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
