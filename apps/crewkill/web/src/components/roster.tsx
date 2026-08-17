"use client";

import type { MatchView, SeatView } from "@crewkill/protocol";
import { Crewmate } from "./sprite";

/**
 * The crew, the work, and the ambience.
 *
 * Ported from the OneChain build's `AgentCard`, `TaskBar` and `WalkingCharacters`. The
 * rebuild had flattened all three into text rows and a plain progress bar, which reads as a
 * table of records rather than a crew.
 */

/**
 * One seat, as a card.
 *
 * The original showed a wallet address and a win rate. Neither exists here by design: a seat
 * is a commitment, and there is no persistent identity to keep a record against. What it
 * shows instead is what is actually knowable mid-match - where they are, what they have
 * finished, whether they are alive - which is also exactly the evidence an argument is made
 * from.
 */
export function AgentCard({
  seat,
  isYou,
  votes,
}: {
  seat: SeatView;
  isYou: boolean;
  votes?: number;
}) {
  const tone = !seat.alive
    ? "var(--color-dim)"
    : isYou
      ? "var(--color-cyan)"
      : seat.revealedRole === "impostor"
        ? "var(--color-alarm)"
        : "var(--color-line)";

  return (
    <div
      className="flex items-start gap-3 border p-3"
      style={{ borderColor: tone, opacity: seat.alive ? 1 : 0.45 }}
    >
      <Crewmate seatIndex={seat.index} size={44} alive={seat.alive} showName={false} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px]">{seat.persona}</span>
          <span className="tele shrink-0">
            {isYou ? "you" : seat.isAgent ? "agent" : "player"}
          </span>
        </div>

        <div className="mt-1 text-[11px] text-[var(--color-dim)]">
          {seat.alive ? (
            <>
              {seat.locationName}
              {seat.onCameras ? ", on cameras" : ""}
            </>
          ) : (
            <>
              {seat.eliminatedBy === "vote" ? "ejected" : "killed"} in round{" "}
              {seat.eliminatedRound}
            </>
          )}
        </div>

        {/* Work done is public, so it is the one hard number an argument can lean on. */}
        <div className="mt-2 flex items-center gap-2">
          <TaskBar completed={seat.tasksCompleted} total={seat.totalTasks} compact />
          <span className="numeric shrink-0 text-[10px] text-[var(--color-dim)]">
            {seat.tasksCompleted}/{seat.totalTasks}
          </span>
        </div>

        {seat.revealedRole && (
          <div
            className="tele mt-2"
            style={{
              color:
                seat.revealedRole === "impostor"
                  ? "var(--color-alarm)"
                  : "var(--color-signal)",
            }}
          >
            {seat.revealedRole}
          </div>
        )}

        {votes !== undefined && votes > 0 && (
          <div className="tele mt-1 text-[var(--color-amber)]">
            {votes} vote{votes === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Task progress, in segments rather than as a smooth bar.
 *
 * A task is discrete: two rounds of work in the right room, and it is either done or it is
 * not. A continuous fill implies a precision the game does not have, so this draws one cell
 * per task and lights the finished ones.
 */
export function TaskBar({
  completed,
  total,
  compact = false,
}: {
  completed: number;
  total: number;
  compact?: boolean;
}) {
  if (total <= 0) return null;
  return (
    <span
      className="flex flex-1 gap-[2px]"
      role="img"
      aria-label={`${completed} of ${total} tasks finished`}
    >
      {Array.from({ length: total }).map((_unused, i) => (
        <span
          key={i}
          className="block flex-1"
          style={{
            height: compact ? 4 : 8,
            background: i < completed ? "var(--color-signal)" : "var(--color-line)",
          }}
        />
      ))}
    </span>
  );
}

/** Crew-wide progress, with the stakes spelled out. */
export function CrewProgress({ match }: { match: MatchView }) {
  const done = match.seats.reduce((sum, seat) => sum + seat.tasksCompleted, 0);
  const total = match.seats.reduce((sum, seat) => sum + seat.totalTasks, 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="tele">Crew tasks</span>
        <span className="numeric text-[11px] text-[var(--color-dim)]">
          {Math.round(match.taskProgress * 100)}%
        </span>
      </div>
      <TaskBar completed={done} total={Math.max(total, 1)} />
      <p className="mt-2 text-[11px] text-[var(--color-dim)]">
        Finish every task and the crew wins without catching anybody.
      </p>
    </div>
  );
}

/**
 * Crew drifting across the lobby while it fills.
 *
 * The original had characters walking the menu screen. Kept, because a lobby with nothing
 * moving in it reads as broken rather than waiting, and cut down to a handful so it stays
 * ambience instead of becoming the subject. Seat colours are reused so the faces are the
 * ones you are about to play with.
 */
export function WalkingCrew({ seatCount }: { seatCount: number }) {
  const walkers = Array.from({ length: Math.min(4, Math.max(2, seatCount - 2)) });
  return (
    <div
      className="pointer-events-none relative h-16 overflow-hidden"
      aria-hidden
    >
      {walkers.map((_unused, i) => (
        <span
          key={i}
          className="walker absolute bottom-0"
          style={{
            animationDelay: `${i * 5.5}s`,
            animationDuration: `${19 + i * 4}s`,
          }}
        >
          <Crewmate seatIndex={i} size={30} alive moving showName={false} />
        </span>
      ))}
    </div>
  );
}
