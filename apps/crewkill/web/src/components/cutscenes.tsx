"use client";

import { MatchPhase, type MatchView } from "@crewkill/protocol";
import { useEffect, useRef, useState } from "react";
import { Crewmate } from "./sprite";

/**
 * The four moments a match stops for.
 *
 * Ported from the OneChain build's `EventScreens`, which had them and the Starknet rebuild
 * did not. The rebuild announced a body, an ejection and a result as another line in the
 * log, which is the difference between a game and a feed: the tense beats need to interrupt.
 *
 * Implemented in the console's own language rather than copied wholesale. The original used
 * framer-motion springs and rounded cards, which would fight the tactical-telemetry
 * direction; these are stepped CSS on square frames. Same beats, same timing, this system.
 *
 * Every screen is driven by real match state, so none of them can fire on a moment that did
 * not actually happen on-chain.
 */

type Beat =
  | { kind: "meeting"; round: number }
  | { kind: "body"; round: number; victim: number }
  | { kind: "ejection"; round: number; seat: number | null }
  | { kind: "end"; crewWon: boolean };

/** How long each beat holds the screen. Long enough to read, short enough not to annoy. */
const HOLD_MS: Record<Beat["kind"], number> = {
  meeting: 2600,
  body: 2800,
  ejection: 3400,
  end: 4200,
};

export function Cutscenes({ match }: { match: MatchView }) {
  const [beat, setBeat] = useState<Beat | null>(null);
  // What we have already played, so a beat fires once rather than on every poll.
  const played = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fire = (key: string, next: Beat) => {
      if (played.current.has(key)) return;
      played.current.add(key);
      setBeat(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBeat(null), HOLD_MS[next.kind]);
    };

    // Settled outranks everything: it is the last thing that happens.
    if (match.phase === MatchPhase.Settled) {
      fire(`end-${match.matchId}`, { kind: "end", crewWon: match.crewWon ?? false });
      return;
    }

    // A body found this round, from the events the keeper recorded on-chain actions for.
    const body = match.events.find(
      (event) => event.kind === "body_found" && event.round === match.round,
    );
    if (body) {
      const victim = match.bodies.find((b) => b.round === match.round);
      fire(`body-${match.matchId}-${match.round}`, {
        kind: "body",
        round: match.round,
        victim: victim?.victim ?? -1,
      });
      return;
    }

    // An ejection is announced once the round's vote has resolved.
    const ejected = match.events.find(
      (event) => event.kind === "ejected" && event.round === match.round,
    );
    if (ejected) {
      const dead = match.seats.find(
        (seat) => !seat.alive && seat.eliminatedRound === match.round && seat.eliminatedBy === "vote",
      );
      fire(`eject-${match.matchId}-${match.round}`, {
        kind: "ejection",
        round: match.round,
        seat: dead?.index ?? null,
      });
      return;
    }

    if (match.roundPhase === "meeting" && match.round > 0) {
      fire(`meet-${match.matchId}-${match.round}`, { kind: "meeting", round: match.round });
    }
  }, [match]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!beat) return null;

  return (
    <div
      className="cutscene fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "color-mix(in srgb, var(--void) 88%, transparent)" }}
      role="status"
      aria-live="polite"
    >
      {beat.kind === "meeting" && <MeetingCalled round={beat.round} />}
      {beat.kind === "body" && <BodyFound match={match} victim={beat.victim} />}
      {beat.kind === "ejection" && <Ejection match={match} seat={beat.seat} />}
      {beat.kind === "end" && <MatchEnd match={match} crewWon={beat.crewWon} />}
    </div>
  );
}

function Slab({
  tone,
  eyebrow,
  headline,
  children,
}: {
  tone: string;
  eyebrow: string;
  headline: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="cutscene-slab frame w-full max-w-2xl p-8 text-center"
      style={{ borderColor: tone }}
    >
      <div className="tele" style={{ color: tone }}>
        {eyebrow}
      </div>
      <h2 className="macro macro-xl mt-3" style={{ color: tone }}>
        {headline}
      </h2>
      {children}
    </div>
  );
}

function MeetingCalled({ round }: { round: number }) {
  return (
    <Slab tone="var(--color-cyan)" eyebrow={`Round ${round}`} headline="Meeting">
      <p className="mt-4 text-[13px] text-[var(--color-dim)]">
        Everyone is back in the room. Ballots are live.
      </p>
    </Slab>
  );
}

function BodyFound({ match, victim }: { match: MatchView; victim: number }) {
  const seat = match.seats[victim];
  return (
    <Slab tone="var(--color-alarm)" eyebrow="Body reported" headline="Dead">
      {seat && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Crewmate seatIndex={seat.index} size={64} alive={false} showName={false} />
          <div className="text-left">
            <div className="text-[15px]">{seat.persona}</div>
            <div className="text-[12px] text-[var(--color-dim)]">
              found in {seat.locationName}
            </div>
          </div>
        </div>
      )}
      <p className="mt-4 text-[13px] text-[var(--color-dim)]">
        Whoever did it is still in the room.
      </p>
    </Slab>
  );
}

function Ejection({ match, seat }: { match: MatchView; seat: number | null }) {
  const row = seat === null ? null : match.seats[seat];
  if (!row) {
    return (
      <Slab tone="var(--color-dim)" eyebrow="Vote resolved" headline="Nobody">
        <p className="mt-4 text-[13px] text-[var(--color-dim)]">
          The vote split. Everyone stays aboard for another round.
        </p>
      </Slab>
    );
  }

  return (
    <Slab tone="var(--color-amber)" eyebrow="Ejected" headline={row.persona}>
      {/* The float: the sprite drifts off while the verdict holds. */}
      <div className="mt-6 flex h-28 items-start justify-center">
        <span className="eject-float inline-block">
          <Crewmate seatIndex={row.index} size={72} alive showName={false} />
        </span>
      </div>
      <p className="mt-2 text-[13px] text-[var(--color-dim)]">
        {/* Roles stay sealed until the reveal window, so this genuinely cannot say more. */}
        Their role stays sealed until the match ends. Nobody knows yet whether that was
        the right call.
      </p>
    </Slab>
  );
}

function MatchEnd({ match, crewWon }: { match: MatchView; crewWon: boolean }) {
  const impostors = match.seats.filter((seat) => seat.revealedRole === "impostor");
  const tone = crewWon ? "var(--color-signal)" : "var(--color-alarm)";
  return (
    <Slab
      tone={tone}
      eyebrow="Settled on-chain"
      headline={crewWon ? "Crew win" : "Impostors win"}
    >
      {impostors.length > 0 && (
        <div className="mt-5">
          <div className="tele">
            {impostors.length === 1 ? "The impostor" : "The impostors"}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
            {impostors.map((seat) => (
              <span key={seat.index} className="flex items-center gap-2">
                <Crewmate seatIndex={seat.index} size={44} alive showName={false} />
                <span className="text-[13px]">{seat.persona}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="mt-5 text-[13px] text-[var(--color-dim)]">
        Payouts are computed by the contract. Every role above was recomputed from the
        published seed, so you can check the result rather than take it.
      </p>
    </Slab>
  );
}
