/**
 * Adapter: live match state → the shapes the ported game components expect.
 *
 * `ScrollableMap` and friends came over from the OneChain build untouched. They think in
 * `Player[]` keyed by address, because that is what OneChain gave them. CrewKill on Starknet
 * has no addresses to hand out — a seat is a commitment, deliberately — so this maps seat
 * indices onto the identifiers the art needs, and nothing on the rendering side had to
 * change to accommodate the privacy model.
 */

import { MatchPhase, type MatchView, type SeatView } from "@crewkill/protocol";
import { GamePhase, Role, type DeadBody, type Location, type Player } from "@/types/game";

/** A stable, synthetic identifier per seat. Never a wallet — there isn't one. */
export function seatAddress(seatIndex: number): `0x${string}` {
  return `0x${(seatIndex + 1).toString(16).padStart(40, "0")}` as `0x${string}`;
}

export function seatIndexFromAddress(address: string): number {
  return Number(BigInt(address)) - 1;
}

function toPlayer(seat: SeatView): Player {
  return {
    address: seatAddress(seat.index),
    name: seat.persona,
    colorId: seat.index % 12,
    // Roles stay sealed until the reveal window, so the map is told "unknown" during play —
    // it cannot leak what the client itself does not know about other seats.
    role:
      seat.revealedRole === "impostor"
        ? Role.Impostor
        : seat.revealedRole === "crew"
          ? Role.Crewmate
          : Role.None,
    location: seat.location as Location,
    isAlive: seat.alive,
    tasksCompleted: seat.tasksCompleted,
    totalTasks: seat.totalTasks,
    hasVoted: false,
    isAIAgent: seat.isAgent,
    agentPersona: seat.isAgent
      ? { emoji: seat.emoji, title: seat.persona, playstyle: "Autonomous" }
      : undefined,
  };
}

export function toPlayers(match: MatchView): Player[] {
  return match.seats.map(toPlayer);
}

export function toDeadBodies(match: MatchView): DeadBody[] {
  return match.bodies.map((body) => ({
    victim: seatAddress(body.victim),
    location: body.location as Location,
    round: BigInt(body.round),
    reported: body.reported,
  }));
}

/** The map dims itself and changes affordances by phase, so give it the closest equivalent. */
export function toGamePhase(match: MatchView): GamePhase {
  if (match.phase === MatchPhase.Lobby) return GamePhase.Lobby;
  if (match.phase === MatchPhase.Revealing) return GamePhase.Resolution;
  if (match.phase === MatchPhase.Settled || match.phase === MatchPhase.Aborted) {
    return GamePhase.Ended;
  }
  switch (match.roundPhase) {
    case "night":
      return GamePhase.ActionCommit;
    case "meeting":
      return GamePhase.Discussion;
    case "voting":
      return GamePhase.Voting;
    default:
      return GamePhase.Starting;
  }
}
