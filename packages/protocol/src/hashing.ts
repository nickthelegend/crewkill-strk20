/**
 * The TypeScript half of CrewKill's commitment scheme.
 *
 * Every function here has an exact counterpart in `cairo/src/hashing.cairo`. If the two
 * ever disagree, players cannot claim their money — so `tests/hashing.test.ts` pins the
 * TypeScript output against vectors asserted inside the Cairo test suite.
 */

import { hash, shortString } from "starknet";

/** Domain-separation tags, byte-identical to `cairo/src/constants.cairo`. */
export const TAGS = {
  SEAT: "CREWKILL_SEAT:V1",
  CLAIM: "CREWKILL_CLAIM:V1",
  OPSEED: "CREWKILL_OPSEED:V1",
  DRAW: "CREWKILL_DRAW:V1",
  VOTE: "CREWKILL_VOTE:V1",
  KILL: "CREWKILL_KILL:V1",
  ACTION: "CREWKILL_ACTION:V1",
} as const;

/** Sentinel target meaning "skip vote". Matches `NO_TARGET` in Cairo. */
export const NO_TARGET = 0xffffffff;

const STARK_PRIME =
  0x800000000000011000000000000000000000000000000000000000000000001n;

function tag(name: keyof typeof TAGS): bigint {
  return BigInt(shortString.encodeShortString(TAGS[name]));
}

/** `core::poseidon::poseidon_hash_span` over the same felt sequence. */
function poseidon(...values: bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(values.map((v) => v.toString())));
}

/**
 * The public identity of a seat.
 *
 * Binds the role secret (which decides the role) to the claim commitment (which gates the
 * money), so publishing the role secret at the end of a match does not hand anyone else
 * the payout.
 */
export function seatCommitment(roleSecret: bigint, claimCommitment: bigint): bigint {
  return poseidon(tag("SEAT"), roleSecret, claimCommitment);
}

/** Published at reveal time; checked again against the claim secret when money moves. */
export function claimCommitment(claimSecret: bigint): bigint {
  return poseidon(tag("CLAIM"), claimSecret);
}

/** The operator's pre-commitment to its half of the role randomness. */
export function seedCommitment(operatorSeed: bigint): bigint {
  return poseidon(tag("OPSEED"), operatorSeed);
}

/**
 * `final_seed`, exactly as `start_match` derives it on-chain: the operator's seed followed
 * by every seat commitment in seat order. Each player's commitment is entropy the operator
 * had not seen when it fixed its own seed.
 */
export function finalSeed(operatorSeed: bigint, seatCommitments: bigint[]): bigint {
  return poseidon(operatorSeed, ...seatCommitments);
}

/**
 * A seat's private role draw. Computable only by whoever holds `roleSecret` — which is why
 * the operator that runs the servers cannot learn who the impostors are.
 */
export function roleDraw(finalSeedValue: bigint, roleSecret: bigint): bigint {
  return poseidon(tag("DRAW"), finalSeedValue, roleSecret);
}

/** Whether a draw lands in the impostor band. `impostorBps` out of 10000 draws do. */
export function drawIsImpostor(draw: bigint, impostorBps: number): boolean {
  return draw % 10000n < BigInt(impostorBps);
}

/** Convenience: resolve a seat's own role once `final_seed` is public. */
export function isImpostor(
  finalSeedValue: bigint,
  roleSecret: bigint,
  impostorBps: number,
): boolean {
  return drawIsImpostor(roleDraw(finalSeedValue, roleSecret), impostorBps);
}

/**
 * An anonymous vote receipt. Unforgeable without the role secret, and unlinkable to a seat
 * until that secret is published — at which point the whole match becomes auditable.
 */
export function voteReceipt(roleSecret: bigint, round: number, targetSeat: number): bigint {
  return poseidon(tag("VOTE"), roleSecret, BigInt(round), BigInt(targetSeat));
}

/** An anonymous night action, validated against revealed impostor secrets at settlement. */
export function killCommitment(
  roleSecret: bigint,
  round: number,
  victimSeat: number,
): bigint {
  return poseidon(tag("KILL"), roleSecret, BigInt(round), BigInt(victimSeat));
}

/**
 * A capability token for driving a seat's *gameplay* actions through the keeper.
 *
 * Only the seat holder can compute it, because it needs both secrets. It is not a proof —
 * the keeper cannot verify it against anything on-chain — so the keeper binds the first
 * token it sees for a seat and rejects later ones. The blast radius of losing that race is
 * small and bounded: a griefer could stop a seat from walking around the ship, and could not
 * touch its role, its ballots, or a single unit of its payout, all of which live on-chain.
 */
export function actionToken(roleSecret: bigint, claimSecret: bigint): bigint {
  return poseidon(tag("ACTION"), roleSecret, claimSecret);
}

/**
 * Fresh seat material. Both halves stay on the player's device: losing them means losing
 * both the role and the payout, so the client persists them before it ever submits a stake.
 */
export function generateSeatSecrets(): { roleSecret: bigint; claimSecret: bigint } {
  return { roleSecret: randomFelt(), claimSecret: randomFelt() };
}

/** A uniformly random field element, rejection-sampled to stay below the STARK prime. */
export function randomFelt(): bigint {
  const bytes = new Uint8Array(32);
  for (;;) {
    crypto.getRandomValues(bytes);
    // Clear the top byte so the 31-byte remainder is always in range.
    bytes[0] = 0;
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    if (value > 0n && value < STARK_PRIME) return value;
  }
}

export function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}
