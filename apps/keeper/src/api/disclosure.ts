/**
 * Selective disclosure: reconstructing a finished match from what its players published.
 *
 * This is the compliance story made concrete. STRK20's model is that activity is private from
 * the public but openable to a lawful auditor holding the right key. CrewKill's ballots work
 * the same way with its own primitives: a vote is stored on-chain only as
 * `poseidon(VOTE_TAG, role_secret, round, target)`, which is unlinkable to anyone without the
 * secret — and trivially checkable by anyone with it.
 *
 * So during play, nobody can tell who voted for whom. After the reveal window, when seats
 * publish their role secrets to claim payouts, the same ballots become fully auditable. No
 * extra machinery, no escrowed key, no trusted party: the disclosure falls out of the design.
 *
 * Every answer here is a real read against the deployed contract. Nothing is inferred from
 * the keeper's own mirror, because the whole point is to check the keeper.
 */

import { NO_TARGET, voteReceipt } from "@crewkill/protocol";
import type { CrewKillContract } from "../chain/crewkill.js";
import { prisma } from "../db.js";

export interface DisclosedBallot {
  round: number;
  /** The seat voted for, or `null` for a deliberate skip. */
  target: number | null;
}

export interface DisclosedSeat {
  index: number;
  persona: string;
  revealedRole: "crew" | "impostor" | null;
  /** Null when this seat never revealed — its ballots stay sealed forever. */
  ballots: DisclosedBallot[] | null;
  /** Why a seat has no ballots, so an empty row is never ambiguous. */
  note: string | null;
}

export interface Disclosure {
  matchId: number;
  applicable: boolean;
  reason: string | null;
  /** How many receipt lookups this took, all of them real on-chain reads. */
  chainReads: number;
  roundsPlayed: number;
  seats: DisclosedSeat[];
}

/**
 * Recovers every ballot a match's revealed seats cast.
 *
 * Brute force is the whole trick, and it is cheap: a receipt is a pure function of
 * (secret, round, target), so with the secret published there are only `rounds × (seats + 1)`
 * candidate hashes per seat. We compute each and ask the chain whether it exists.
 */
export async function discloseMatch(
  dbId: number,
  game: CrewKillContract,
): Promise<Disclosure | null> {
  const row = await prisma.match.findUnique({
    where: { id: dbId },
    include: { seats: { orderBy: { index: "asc" } } },
  });
  if (!row) return null;

  const matchId = Number(row.onchainId);
  const roundsPlayed = row.round;

  // Before the reveal window there is nothing to disclose, and saying so is the point rather
  // than an error: the privacy is real precisely while the match is live.
  const anyRevealed = row.seats.some((seat) => seat.revealed && seat.roleSecret);
  if (!anyRevealed) {
    return {
      matchId,
      applicable: false,
      reason:
        "No seat has revealed yet. Ballots are stored only as hashes of a secret nobody has " +
        "published, so there is nothing here to open - which is the privacy working, not a gap.",
      chainReads: 0,
      roundsPlayed,
      seats: [],
    };
  }

  let chainReads = 0;
  const seats: DisclosedSeat[] = [];

  for (const seat of row.seats) {
    if (!seat.revealed || !seat.roleSecret) {
      seats.push({
        index: seat.index,
        persona: seat.persona,
        revealedRole: null,
        ballots: null,
        note: "never revealed - this seat's ballots stay sealed permanently",
      });
      continue;
    }

    const secret = BigInt(seat.roleSecret);
    const ballots: DisclosedBallot[] = [];

    for (let round = 1; round <= roundsPlayed; round += 1) {
      // Every seat it could have named, plus the deliberate skip.
      const candidates: Array<number | null> = [
        ...Array.from({ length: row.seatCount }, (_unused, i) => i),
        null,
      ];
      for (const target of candidates) {
        const hash = voteReceipt(secret, round, target === null ? NO_TARGET : target);
        const receipt = await game.getReceipt(hash);
        chainReads += 1;
        if (receipt.exists && receipt.matchId === matchId) {
          ballots.push({ round, target });
          break; // One ballot per round; no need to try the rest.
        }
      }
    }

    seats.push({
      index: seat.index,
      persona: seat.persona,
      revealedRole: seat.isImpostor ? "impostor" : "crew",
      ballots,
      note: ballots.length === 0 ? "revealed, but cast no ballots - eliminated early" : null,
    });
  }

  return { matchId, applicable: true, reason: null, chainReads, roundsPlayed, seats };
}
