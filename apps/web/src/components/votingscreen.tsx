"use client";

import { NO_TARGET, type MatchView } from "@crewkill/protocol";
import { useState } from "react";
import { Crewmate } from "./sprite";

/**
 * The meeting table.
 *
 * Ported from the OneChain build's `VotingScreen`. The Starknet rebuild had reduced the
 * tensest moment in the game to a two-column grid of buttons in a side panel, which is a
 * reasonable way to collect input and a terrible way to hold a vote. Everyone sitting around
 * a table looking at each other is the entire point of the format.
 *
 * Seats are laid out on a circle, so you can see who is left and who is already gone at a
 * glance. The living are pickable; the dead stay at the table greyed out, because knowing
 * who died and when is evidence.
 *
 * What it deliberately does not show, unlike the original: who voted for whom. The original
 * ran on a server that knew. Here the chain stores only a hash of a secret nobody has
 * published, so that information does not exist yet, and inventing it would be a lie about
 * the one property this game is built on.
 */
export function VotingScreen({
  match,
  yourSeat,
  busy,
  onVote,
  onClose,
}: {
  match: MatchView;
  yourSeat: number | null;
  busy: boolean;
  onVote: (target: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const seats = match.seats;
  const alive = seats.filter((seat) => seat.alive);
  const you = yourSeat === null ? null : seats[yourSeat];
  const canVote = Boolean(you?.alive) && match.roundPhase === "voting";

  // The table. Radius is in percent of the plate so it scales with the viewport.
  const position = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    return {
      left: `${50 + Math.cos(angle) * 37}%`,
      top: `${50 + Math.sin(angle) * 37}%`,
    };
  };

  const tally = match.tallies.find((entry) => entry.round === match.round);
  const cast = tally ? tally.targets.reduce((sum, target) => sum + target.votes, 0) : 0;

  return (
    <div
      className="cutscene fixed inset-0 z-40 flex flex-col"
      style={{ background: "color-mix(in srgb, var(--void) 94%, transparent)" }}
    >
      <header className="flex items-baseline justify-between gap-4 p-4">
        <div>
          <div className="tele">Round {match.round} meeting</div>
          <h2 className="macro macro-lg mt-1">Who goes out</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="numeric text-[13px] text-[var(--color-dim)]">
            {cast}/{alive.length} cast
          </span>
          <button onClick={onClose} className="switch">
            Watch the ship
          </button>
        </div>
      </header>

      {/* The table itself. */}
      <div className="relative mx-auto w-full max-w-3xl flex-1">
        {/* A ring to sit around, so the seats read as a table rather than scattered. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: "var(--color-line)" }}
        />

        {seats.map((seat, i) => {
          const pos = position(i, seats.length);
          const isYou = seat.index === yourSeat;
          const pickable = canVote && seat.alive && !isYou;
          const isSelected = selected === seat.index;

          return (
            <button
              key={seat.index}
              onClick={() => pickable && setSelected(isSelected ? null : seat.index)}
              disabled={!pickable}
              aria-pressed={isSelected}
              className="absolute -translate-x-1/2 -translate-y-1/2 p-2 text-center disabled:cursor-default"
              style={pos}
            >
              <span
                className="block border p-2"
                style={{
                  borderColor: isSelected
                    ? "var(--color-alarm)"
                    : isYou
                      ? "var(--color-cyan)"
                      : "transparent",
                  opacity: seat.alive ? 1 : 0.32,
                }}
              >
                <Crewmate
                  seatIndex={seat.index}
                  size={62}
                  alive={seat.alive}
                  showName={false}
                />
                <span className="mt-1 block text-[12px]">{seat.persona}</span>
                <span className="tele block">
                  {isYou ? "you" : seat.alive ? seat.locationName : "dead"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls. */}
      <div className="border-t border-[var(--color-line)] p-4">
        {!canVote ? (
          <p className="text-center text-[13px] text-[var(--color-dim)]">
            {you && !you.alive
              ? "You are dead. You can watch the vote, but you cannot cast one."
              : "You are spectating this match."}
          </p>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--color-dim)]">
              {selected === null
                ? "Pick someone, or skip. A ballot is a note you spend, so you get one per round."
                : `Ejecting ${seats[selected].persona}. Nothing on-chain will say it was you.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onVote(NO_TARGET)}
                disabled={busy}
                className="switch"
              >
                Skip
              </button>
              <button
                onClick={() => selected !== null && onVote(selected)}
                disabled={busy || selected === null}
                className="switch switch-primary"
              >
                {busy ? "Casting" : "Cast ballot"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
