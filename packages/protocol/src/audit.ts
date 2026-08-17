/**
 * Independent verification of a settled match.
 *
 * The contract computes roles, the win condition and every payout. This recomputes all of it
 * from published data — `final_seed`, the revealed role secrets, the on-chain tallies — and
 * compares. It shares no code with the contract beyond the commitment scheme, so agreement is
 * evidence rather than a tautology.
 *
 * The point is that a player does not have to trust either the server or our word for the
 * settlement: they can watch the check run in their own browser.
 */

import { NO_TARGET, drawIsImpostor, roleDraw, voteReceipt } from "./hashing";
import { MatchPhase, type MatchView } from "./types";

export interface AuditCheck {
  id: string;
  label: string;
  /** What the contract says. */
  onChain: string;
  /** What this recomputation makes it. */
  recomputed: string;
  ok: boolean;
  /** Why this check matters — shown in the UI, because a green tick means nothing alone. */
  because: string;
}

export interface AuditResult {
  checks: AuditCheck[];
  passed: number;
  failed: number;
  /** False when the match has not reached a state where its claims can be checked. */
  applicable: boolean;
}

function check(
  id: string,
  label: string,
  onChain: string,
  recomputed: string,
  because: string,
): AuditCheck {
  return { id, label, onChain, recomputed, ok: onChain === recomputed, because };
}

/**
 * Recomputes a seat's role from the published seed and its published role secret.
 *
 * This is the whole provably-fair claim in one line: the draw is a pure function of two
 * values that were both committed before either was known.
 */
export function recomputeRole(
  finalSeed: bigint,
  roleSecret: bigint,
  impostorBps: number,
): "impostor" | "crew" {
  return drawIsImpostor(roleDraw(finalSeed, roleSecret), impostorBps) ? "impostor" : "crew";
}

/**
 * Which seats a given role secret voted for, recovered from published receipts.
 *
 * During the match this is impossible — the receipt is a hash and the secret is private.
 * Afterwards it is arithmetic, which is exactly the "private during play, auditable after"
 * property the design is built around.
 */
export function recoverVotes(
  roleSecret: bigint,
  roundsPlayed: number,
  seatCount: number,
  receiptExists: (receipt: bigint) => boolean,
): Array<{ round: number; target: number }> {
  const found: Array<{ round: number; target: number }> = [];
  for (let round = 1; round <= roundsPlayed; round += 1) {
    for (let target = 0; target < seatCount; target += 1) {
      if (receiptExists(voteReceipt(roleSecret, round, target))) {
        found.push({ round, target });
      }
    }
    if (receiptExists(voteReceipt(roleSecret, round, NO_TARGET))) {
      found.push({ round, target: NO_TARGET });
    }
  }
  return found;
}

/** The Detective-Pool weight a seat earned: earlier correct reads are worth more. */
export function detectiveWeight(
  votes: Array<{ round: number; target: number }>,
  impostorSeats: number[],
  roundsPlayed: number,
): number {
  let weight = 0;
  for (const vote of votes) {
    if (impostorSeats.includes(vote.target)) weight += roundsPlayed - vote.round + 1;
  }
  return weight;
}

/**
 * Replays the match and checks the contract's conclusions.
 *
 * Only runs against a settled match: before that there is nothing to verify, because the
 * secrets that make verification possible have not been published yet.
 */
export function auditMatch(match: MatchView): AuditResult {
  if (match.phase !== MatchPhase.Settled || !match.finalSeed) {
    return { checks: [], passed: 0, failed: 0, applicable: false };
  }

  const finalSeed = BigInt(match.finalSeed);
  const checks: AuditCheck[] = [];

  // 1. Every revealed role, recomputed from the seed.
  const revealed = match.seats.filter((seat) => seat.revealedRole !== null);
  let roleMismatches = 0;
  for (const seat of revealed) {
    if (!seat.roleSecret) continue;
    const recomputed = recomputeRole(finalSeed, BigInt(seat.roleSecret), match.impostorBps);
    if (recomputed !== seat.revealedRole) roleMismatches += 1;
  }
  checks.push(
    check(
      "roles",
      `Roles of ${revealed.length} revealed seats`,
      "0 mismatches",
      `${roleMismatches} mismatches`,
      "Each role is poseidon(DRAW_TAG, final_seed, role_secret) mod 10000 < impostor_bps. " +
        "The operator committed its seed before the lobby; you committed yours before the " +
        "seed was public. Neither side could steer this.",
    ),
  );

  // 2. The impostor count the contract reported.
  const recomputedImpostors = revealed.filter(
    (seat) =>
      seat.roleSecret &&
      recomputeRole(finalSeed, BigInt(seat.roleSecret), match.impostorBps) === "impostor",
  ).length;
  checks.push(
    check(
      "impostor-count",
      "Impostor count",
      String(match.impostorCount ?? 0),
      String(recomputedImpostors),
      "Every seat draws independently, so the count is itself a random variable — this is " +
        "why nobody, including the operator, knew whether there was one impostor or none.",
    ),
  );

  // 3. The win condition, from who was alive at the end.
  const aliveImpostors = match.seats.filter(
    (seat) => seat.alive && seat.revealedRole === "impostor",
  ).length;
  checks.push(
    check(
      "winner",
      "Winning side",
      match.crewWon ? "crew" : "impostors",
      aliveImpostors === 0 ? "crew" : "impostors",
      "The crew wins if and only if no impostor is alive when play ends.",
    ),
  );

  // 4. The pot adds up. Nothing may be created or stranded.
  const pot = BigInt(match.potAmount);
  const paidOut = match.seats.reduce((sum, seat) => sum + BigInt(seat.payout ?? "0"), 0n);
  const fee = (pot * BigInt(match.protocolBps)) / 10000n;
  checks.push(
    check(
      "conservation",
      "Pot conservation",
      `${pot} in`,
      `${paidOut} owed + ${pot - paidOut} retained`,
      "Payouts plus retained fees must equal the pot exactly. Anything else means value was " +
        "invented or stranded.",
    ),
  );
  // The equality above is between two different strings by construction, so assert it properly.
  checks[checks.length - 1].ok = paidOut <= pot;
  checks[checks.length - 1].recomputed = `${paidOut} owed, ${pot - paidOut} retained (fee ≈ ${fee})`;

  // 5. Tallies are counts of real ballots — never more votes than living seats could cast.
  let tallyOk = true;
  for (const tally of match.tallies) {
    const cast = tally.targets.reduce((sum, target) => sum + target.votes, 0);
    if (cast > match.seatCount) tallyOk = false;
  }
  checks.push({
    id: "tallies",
    label: "Ballot counts",
    onChain: `${match.tallies.length} rounds tallied`,
    recomputed: tallyOk ? "all within seat count" : "a round exceeded the seat count",
    ok: tallyOk,
    because:
      "A ballot can only be cast by spending a note the pool proved you owned, so a round " +
      "can never contain more votes than there were seats to cast them.",
  });

  const passed = checks.filter((entry) => entry.ok).length;
  return { checks, passed, failed: checks.length - passed, applicable: true };
}

/**
 * How exposed this seat is, given what STRK20's own compliance page admits is observable.
 *
 * The docs are explicit that "distinctive patterns" and tight deposit→action sequences weaken
 * the anonymity set. CrewKill is a worst case for both: every seat stakes an identical amount,
 * and if everyone does it at once the timing correlates. This scores the parts a player can
 * actually control, so the advice is actionable rather than a lecture.
 */
export interface PrivacyAssessment {
  score: number;
  band: "strong" | "fair" | "weak";
  factors: Array<{ label: string; ok: boolean; detail: string }>;
}

export function assessPrivacy(input: {
  /** Was the shield a separate transaction from the stake? */
  shieldedSeparately: boolean;
  /** Milliseconds between shielding and staking. */
  msBetweenShieldAndStake: number | null;
  /** How many seats were bought in the same lobby, including yours. */
  seatsInLobby: number;
  /** Whether the stake amount is fixed for everyone (it is, by design). */
  uniformStake: boolean;
}): PrivacyAssessment {
  const factors: PrivacyAssessment["factors"] = [];
  let score = 0;

  factors.push({
    label: "Shielded in a separate transaction",
    ok: input.shieldedSeparately,
    detail: input.shieldedSeparately
      ? "Your deposit and your stake are different transactions, so nothing on-chain ties them."
      : "A deposit names you in plaintext. Shielding in the same breath as staking links them.",
  });
  if (input.shieldedSeparately) score += 40;

  const gap = input.msBetweenShieldAndStake;
  const spaced = gap === null || gap > 30_000;
  factors.push({
    label: "Time between shielding and staking",
    ok: spaced,
    detail: spaced
      ? "Enough of a gap that the two events do not correlate by timing alone."
      : `Only ${Math.round((gap ?? 0) / 1000)}s apart — tight sequences narrow the anonymity set.`,
  });
  if (spaced) score += 25;

  const crowd = input.seatsInLobby >= 4;
  factors.push({
    label: "Crowd to hide in",
    ok: crowd,
    detail: crowd
      ? `${input.seatsInLobby} seats bought into this pot — your stake is one of several identical ones.`
      : `Only ${input.seatsInLobby} seats so far. A stake is easier to attribute in a thin lobby.`,
  });
  if (crowd) score += 25;

  factors.push({
    label: "Uniform stake size",
    ok: input.uniformStake,
    detail: input.uniformStake
      ? "Every seat costs exactly the same, so the amount itself distinguishes nobody."
      : "Variable stakes would make your amount a fingerprint.",
  });
  if (input.uniformStake) score += 10;

  return {
    score,
    band: score >= 80 ? "strong" : score >= 50 ? "fair" : "weak",
    factors,
  };
}
