"use client";

import type { MatchView } from "@crewkill/protocol";
import Image from "next/image";
import { Crewmate } from "./sprite";

/**
 * The landing screen.
 *
 * Ported from the OneChain build's `MainMenu`. The rebuild had replaced it with a stack of
 * bordered cards, which is a fine way to lay out a form and a poor way to open a game: the
 * first thing anyone saw was an empty seat table and a fee schedule.
 *
 * So: the logo at full size with crew floating either side of it, four numbers that are
 * actually live, and one thing to press. The pot, the stake and the privacy detail all still
 * exist, below the fold, where someone who has decided to play can find them.
 *
 * Every metric is real. There is no invented "players online" count, because there is no
 * lobby server to count them and a fake number on the first screen poisons everything after
 * it.
 */
export function MainMenu({
  lobby,
  matches,
  connected,
  onPlay,
  children,
}: {
  lobby: MatchView | null;
  matches: Array<{ matchId: number; phase: number; seatsFilled: number }>;
  connected: boolean;
  onPlay: () => void;
  children: React.ReactNode;
}) {
  const live = matches.filter((m) => m.phase === 1).length;
  const settled = matches.filter((m) => m.phase === 3).length;
  const seated = matches.reduce((sum, m) => sum + m.seatsFilled, 0);
  const openSeats = lobby ? lobby.seatCount - lobby.seatsFilled : 0;

  return (
    <div className="relative">
      {/* Crew drifting behind the logo. Two, slowly, so it reads as ambience. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden>
        <span className="drift-left absolute top-10">
          <Crewmate seatIndex={0} size={56} alive moving showName={false} />
        </span>
        <span className="drift-right absolute top-36">
          <Crewmate seatIndex={3} size={44} alive moving showName={false} />
        </span>
      </div>

      <section className="relative flex flex-col items-center px-5 pt-4 text-center">
        <Image
          src="/text-logo.png"
          alt="CrewKill"
          width={850}
          height={220}
          priority
          className="h-auto w-full max-w-[420px] object-contain"
        />

        <div className="mt-2 flex w-full max-w-[420px] items-center gap-4">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          <span className="tele whitespace-nowrap">Social deduction, staked on-chain</span>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>

        <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Live now" value={live} tone="var(--color-alarm)" pulse={connected} />
          <Metric label="Settled" value={settled} tone="var(--color-signal)" />
          <Metric label="Seats played" value={seated} tone="var(--color-cyan)" />
          <Metric label="Open seats" value={openSeats} tone="var(--color-amber)" />
        </div>

        <button onClick={onPlay} className="menu-cta mt-7" disabled={!lobby}>
          {lobby ? (openSeats > 0 ? "Take a seat" : "Watch the match") : "Waiting for a lobby"}
        </button>

        <p className="mt-4 max-w-md text-[12px] leading-relaxed text-[var(--color-dim)]">
          Your seat is a commitment, never an address. Your role is drawn from a seed nobody
          could steer. Your ballot is a hash until the match is over.
        </p>
      </section>

      <div className="mx-auto mt-12 max-w-3xl px-5 pb-10">{children}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: number;
  tone: string;
  pulse?: boolean;
}) {
  return (
    <div className="frame p-3 text-left">
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span
            className="live-dot block h-1.5 w-1.5"
            style={{ background: tone }}
            aria-hidden
          />
        )}
        <span className="tele">{label}</span>
      </div>
      <div className="macro macro-lg numeric mt-1" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}
