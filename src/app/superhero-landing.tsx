"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const panelItems = [
  ["RAG", "Document-grounded answers with source-ready context."],
  ["CHAT", "Streaming AI responses with visible token impact."],
  ["SECURE", "JWT sessions, bcrypt passwords, protected routes."],
];

export function SuperheroLanding({
  email,
  isAuthenticated,
}: {
  email?: string | null;
  isAuthenticated: boolean;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#18202B] text-white">
      <div className="absolute inset-0 hero-city" />
      <div className="absolute inset-0 hero-noise" />
      <div className="absolute inset-0 hero-halftone" />
      <motion.div
        className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-[#C89B3C] blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="border-4 border-[#1C1B1A] bg-[#C89B3C] px-3 py-2 text-xl font-black uppercase tracking-tighter text-[#1C1B1A] shadow-[6px_6px_0_#8E3A3A]"
        >
          Knowledge Assistant
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span className="hidden border-2 border-[#C89B3C] bg-[#1C1B1A] px-3 py-2 text-xs font-black uppercase tracking-wider text-[#C89B3C] md:inline-block">
              {email}
            </span>
            <Link
              className="bg-[#C89B3C] px-4 py-3 text-sm font-black uppercase tracking-wider text-[#1C1B1A] shadow-[5px_5px_0_#1C1B1A] transition hover:-translate-y-1 hover:translate-x-1 hover:shadow-[2px_2px_0_#1C1B1A]"
              href="/chat"
            >
              Chat Console
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              className="hidden border-2 border-white px-4 py-2 text-sm font-black uppercase tracking-wider text-white transition hover:bg-white hover:text-[#1C1B1A] sm:inline-block"
              href="/login"
            >
              Login
            </Link>
            <Link
              className="bg-[#C89B3C] px-4 py-3 text-sm font-black uppercase tracking-wider text-[#1C1B1A] shadow-[5px_5px_0_#1C1B1A] transition hover:-translate-y-1 hover:translate-x-1 hover:shadow-[2px_2px_0_#1C1B1A]"
              href="/register"
            >
              Register
            </Link>
          </div>
        )}
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-7xl items-center gap-8 px-6 pb-12 pt-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative">
          <motion.p
            className="mb-5 inline-block origin-left -skew-x-6 bg-[#8E3A3A] px-4 py-2 text-sm font-black uppercase tracking-[0.34em] text-white shadow-[7px_7px_0_#1C1B1A]"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            Dev Trainee Assignment
          </motion.p>
          <motion.h1
            className="max-w-4xl text-7xl font-black uppercase leading-[0.78] tracking-tight text-[#C89B3C] drop-shadow-[10px_10px_0_#1C1B1A] sm:text-8xl xl:text-[9.5rem]"
            initial={{ y: 70, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            Ask Like A Hero
          </motion.h1>
          <motion.p
            className="mt-7 max-w-2xl border-l-8 border-[#4F6F86] bg-[#1C1B1A]/80 px-5 py-4 text-lg font-bold leading-8 text-[#E7E1D6] shadow-[10px_10px_0_rgba(142,58,58,0.75)]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            Attach training files inside chat. Fire questions at them. Get
            answers with streaming AI force, tracked tokens, and document memory
            built for the next mission.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <Link
              className="comic-impact bg-[#C89B3C] px-7 py-4 text-center text-lg font-black uppercase tracking-wider text-[#1C1B1A] shadow-[10px_10px_0_#1C1B1A]"
              href={isAuthenticated ? "/chat" : "/register"}
            >
              {isAuthenticated ? "Open Console" : "Start Training"}
            </Link>
            <Link
              className="comic-impact border-4 border-[#4F6F86] bg-[#1C1B1A] px-7 py-4 text-center text-lg font-black uppercase tracking-wider text-white shadow-[10px_10px_0_#4F6F86]"
              href={isAuthenticated ? "/chat" : "/login"}
            >
              {isAuthenticated ? "Ask Now" : "Enter Console"}
            </Link>
          </motion.div>
        </div>

        <div className="relative min-h-[560px]">
          <motion.div
            className="absolute inset-x-0 top-8 mx-auto h-[470px] max-w-[420px] -skew-x-6 border-4 border-[#1C1B1A] bg-[#4F6F86] shadow-[22px_22px_0_#1C1B1A]"
            initial={{ rotate: 4, x: 80, opacity: 0 }}
            animate={{ rotate: -3, x: 0, opacity: 1 }}
            transition={{ duration: 0.55 }}
          />
          <motion.div
            className="superhero-figure absolute left-1/2 top-10 h-[500px] w-[330px] -translate-x-1/2"
            animate={{ y: [0, -18, 0], rotate: [-1, 1.5, -1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="cape" />
            <div className="head" />
            <div className="torso" />
            <div className="emblem">KA</div>
            <div className="arm left" />
            <div className="arm right" />
            <div className="leg left" />
            <div className="leg right" />
          </motion.div>
          <motion.div
            className="absolute bottom-8 left-0 bg-[#8E3A3A] px-5 py-3 text-4xl font-black uppercase text-white shadow-[8px_8px_0_#1C1B1A]"
            animate={{ x: [0, 12, 0] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            Boom
          </motion.div>
          <div className="absolute bottom-20 right-0 h-28 w-28 rounded-full bg-[#C89B3C] opacity-80 blur-xl" />
        </div>
      </section>

      <section className="relative z-10 grid border-y-4 border-[#1C1B1A] bg-[#E7E1D6] text-[#1C1B1A] md:grid-cols-3">
        {panelItems.map(([title, copy], index) => (
          <motion.article
            key={title}
            className="min-h-44 border-[#1C1B1A] p-6 shadow-inner md:border-r-4"
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
          >
            <p className="text-6xl font-black uppercase leading-none text-[#4F6F86] drop-shadow-[4px_4px_0_#C89B3C]">
              {title}
            </p>
            <p className="mt-4 max-w-sm text-base font-bold leading-7">{copy}</p>
          </motion.article>
        ))}
      </section>
    </main>
  );
}
