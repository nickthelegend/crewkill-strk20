/**
 * Your seat lives in this browser and nowhere else.
 *
 * `roleSecret` is what decides whether you are an impostor, and `claimSecret` is the only
 * thing that can move your winnings. Neither is ever sent to the keeper — that is precisely
 * why the operator cannot read your role or spend your payout. The flip side is that
 * clearing site data before a match settles loses the money, so the UI says so out loud and
 * offers the material as an exportable backup.
 */

import {
  claimCommitment,
  generateSeatSecrets,
  seatCommitment,
  type SeatKeypair,
} from "@crewkill/protocol";

const KEY = "crewkill.seats.v1";

function readAll(): Record<string, SeatKeypair> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, SeatKeypair>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SeatKeypair>): void {
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function loadSeat(matchId: number): SeatKeypair | null {
  return readAll()[String(matchId)] ?? null;
}

/** Mints seat material for a match and stores it *before* any stake is submitted. */
export function createSeat(matchId: number): SeatKeypair {
  const existing = loadSeat(matchId);
  if (existing) return existing;

  const { roleSecret, claimSecret } = generateSeatSecrets();
  const record: SeatKeypair = {
    matchId,
    seatIndex: null,
    roleSecret: `0x${roleSecret.toString(16)}`,
    claimSecret: `0x${claimSecret.toString(16)}`,
    seatCommitment: `0x${seatCommitment(roleSecret, claimCommitment(claimSecret)).toString(16)}`,
  };
  const all = readAll();
  all[String(matchId)] = record;
  writeAll(all);
  return record;
}

export function rememberSeatIndex(matchId: number, seatIndex: number): void {
  const all = readAll();
  const record = all[String(matchId)];
  if (!record) return;
  record.seatIndex = seatIndex;
  writeAll(all);
}

export function forgetSeat(matchId: number): void {
  const all = readAll();
  delete all[String(matchId)];
  writeAll(all);
}

export function allSeats(): SeatKeypair[] {
  return Object.values(readAll());
}

/** A copy-paste backup. Losing the secrets means losing the payout, so make it easy to keep. */
export function exportSeat(seat: SeatKeypair): string {
  return JSON.stringify(seat, null, 2);
}

export function importSeat(raw: string): SeatKeypair {
  const parsed = JSON.parse(raw) as SeatKeypair;
  if (!parsed.roleSecret || !parsed.claimSecret || typeof parsed.matchId !== "number") {
    throw new Error("That does not look like CrewKill seat material.");
  }
  const all = readAll();
  all[String(parsed.matchId)] = parsed;
  writeAll(all);
  return parsed;
}
