import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../lib/auth";
import { createUser } from "../../lib/users";

function validateRegisterForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please use a valid email address.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return { name, email, password };
}

export default async function RegisterPage({
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
    <main className="min-h-screen overflow-hidden bg-[#0F172A] px-6 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 hero-noise opacity-70" />
      <div className="pointer-events-none fixed inset-0 hero-halftone opacity-35" />
      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-4 inline-block bg-[#FBB829] px-3 py-1 text-sm font-black uppercase tracking-[0.28em] text-[#111111] shadow-[6px_6px_0_#B91C1C]">
            Recruit File
          </p>
          <h1 className="max-w-2xl text-6xl font-black uppercase leading-[0.85] tracking-tight text-[#FBB829] drop-shadow-[8px_8px_0_#111111] sm:text-8xl">
            Enter The Archive
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold text-[#E5E7EB]">
            Create a secured trainee account, then interrogate your knowledge
            files with AI backup.
          </p>
        </div>

        <form
          className="relative border-4 border-[#111111] bg-white p-6 text-[#111111] shadow-[16px_16px_0_#B91C1C]"
          action={async (formData) => {
            "use server";

            const values = validateRegisterForm(formData);

            try {
              await createUser(values);
            } catch (error) {
              const message =
                error instanceof Error
                  ? encodeURIComponent(error.message)
                  : "Registration failed.";
              redirect(`/register?error=${message}`);
            }

            await signIn("credentials", {
              email: values.email,
              password: values.password,
              redirectTo: "/chat",
            });
          }}
        >
          <div className="absolute -right-4 -top-4 bg-[#2986CC] px-4 py-2 text-sm font-black uppercase tracking-widest text-white shadow-[6px_6px_0_#111111]">
            Register
          </div>
          <h2 className="mb-6 text-4xl font-black uppercase leading-none">
            Suit Up
          </h2>

          <label className="mb-4 flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Name
            <input
              className="h-12 border-2 border-[#111111] bg-[#E5E7EB] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#2986CC]"
              name="name"
              autoComplete="name"
            />
          </label>

          <label className="mb-4 flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Email
            <input
              className="h-12 border-2 border-[#111111] bg-[#E5E7EB] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#2986CC]"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="mb-5 flex flex-col gap-2 text-sm font-black uppercase tracking-wider">
            Password
            <input
              className="h-12 border-2 border-[#111111] bg-[#E5E7EB] px-3 text-base font-semibold outline-none transition focus:bg-white focus:shadow-[5px_5px_0_#2986CC]"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>

          {error ? (
            <p className="mb-4 border-2 border-[#B91C1C] bg-red-50 px-3 py-2 text-sm font-bold text-[#B91C1C]">
              {decodeURIComponent(error)}
            </p>
          ) : null}

          <button className="w-full bg-[#FBB829] px-5 py-4 text-lg font-black uppercase tracking-wider text-[#111111] shadow-[8px_8px_0_#111111] transition hover:-translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0_#111111]">
            Create Account
          </button>

          <p className="mt-6 text-center text-sm font-semibold">
            Already cleared?{" "}
            <Link className="font-black text-[#B91C1C] underline" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
