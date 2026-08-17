/**
 * A typed handle on the deployed CrewKill contract.
 *
 * Reads go straight to the node. Writes are keeper-only lifecycle calls — creating a match,
 * locking the roster, ending play, settling. Notably absent: anything that could move a
 * player's money or read a player's role. The keeper is a clock, not an authority.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Account, Contract, RpcProvider } from "starknet";
import { contractAt, settle } from "./client.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS = join(HERE, "..", "..", "..", "..", "..", "deployments");

export interface Deployment {
  network: string;
  chainId: string;
  rpcUrl: string;
  game: string;
  ballot: string;
  pool: string;
  stakeToken: string;
  owner: string;
  keeper: string;
  transactions: Array<{ kind: string; hash: string }>;
  deployedAt: string;
}

export function loadDeployment(network: string): Deployment {
  const path = join(DEPLOYMENTS, `${network}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Deployment;
  } catch {
    throw new Error(
      `No deployment for "${network}". Run: NETWORK=${network} pnpm --filter @crewkill/keeper deploy:contracts`,
    );
  }
}

export interface OnChainMatch {
  phase: number;
  stakeAmount: bigint;
  seatCount: number;
  seatsFilled: number;
  rounds: number;
  impostorBps: number;
  detectiveBps: number;
  protocolBps: number;
  seedCommitment: bigint;
  finalSeed: bigint;
  pot: bigint;
  roundsPlayed: number;
  crewWon: boolean;
  revealedCount: number;
  impostorCount: number;
  detectiveWeightTotal: number;
}

export interface OnChainSeat {
  seatCommitment: bigint;
  roleSecret: bigint;
  claimCommitment: bigint;
  revealed: boolean;
  isAgent: boolean;
  isImpostor: boolean;
  eliminated: boolean;
  eliminatedRound: number;
  payout: bigint;
  claimed: boolean;
}

export class CrewKillContract {
  private readonly reader: Contract;
  private readonly writer: Contract | null;

  constructor(
    readonly address: string,
    private readonly provider: RpcProvider,
    account?: Account,
  ) {
    this.reader = contractAt("CrewKill", address, provider);
    this.writer = account ? contractAt("CrewKill", address, provider, account) : null;
  }

  private mustWrite(): Contract {
    if (!this.writer) throw new Error("CrewKillContract has no signer configured");
    return this.writer;
  }

  async matchCount(): Promise<number> {
    return Number(await this.reader.call("match_count"));
  }

  async getMatch(matchId: number | bigint): Promise<OnChainMatch> {
    const raw = (await this.reader.call("get_match", [matchId])) as Record<string, unknown>;
    return {
      phase: phaseIndex(raw.phase),
      stakeAmount: BigInt(raw.stake_amount as string),
      seatCount: Number(raw.seat_count),
      seatsFilled: Number(raw.seats_filled),
      rounds: Number(raw.rounds),
      impostorBps: Number(raw.impostor_bps),
      detectiveBps: Number(raw.detective_bps),
      protocolBps: Number(raw.protocol_bps),
      seedCommitment: BigInt(raw.seed_commitment as string),
      finalSeed: BigInt(raw.final_seed as string),
      pot: BigInt(raw.pot as string),
      roundsPlayed: Number(raw.rounds_played),
      crewWon: Boolean(raw.crew_won),
      revealedCount: Number(raw.revealed_count),
      impostorCount: Number(raw.impostor_count),
      detectiveWeightTotal: Number(raw.detective_weight_total),
    };
  }

  async getSeat(matchId: number | bigint, index: number): Promise<OnChainSeat> {
    const raw = (await this.reader.call("get_seat", [matchId, index])) as Record<string, unknown>;
    return {
      seatCommitment: BigInt(raw.seat_commitment as string),
      roleSecret: BigInt(raw.role_secret as string),
      claimCommitment: BigInt(raw.claim_commitment as string),
      revealed: Boolean(raw.revealed),
      isAgent: Boolean(raw.is_agent),
      isImpostor: Boolean(raw.is_impostor),
      eliminated: Boolean(raw.eliminated),
      eliminatedRound: Number(raw.eliminated_round),
      payout: BigInt(raw.payout as string),
      claimed: Boolean(raw.claimed),
    };
  }

  async getTally(matchId: number | bigint, round: number, target: number): Promise<number> {
    return Number(await this.reader.call("get_tally", [matchId, round, target]));
  }

  /**
   * Looks up a vote receipt on-chain.
   *
   * A receipt is `poseidon(VOTE_TAG, role_secret, round, target)`. While a match is running
   * this reveals nothing: you cannot compute the hash without the secret, and the secret is
   * private. Once a seat has revealed, anyone can recompute its receipts and ask the chain
   * which ones exist — which is exactly the selective disclosure the compliance model
   * describes, done with the game's own primitives.
   */
  async getReceipt(receipt: bigint): Promise<{ matchId: number; round: number; targetSeat: number; exists: boolean }> {
    const raw = (await this.reader.call("get_receipt", [receipt])) as Record<string, unknown>;
    return {
      matchId: Number(raw.match_id),
      round: Number(raw.round),
      targetSeat: Number(raw.target_seat),
      exists: Boolean(raw.exists),
    };
  }

  async getKillCount(matchId: number | bigint): Promise<number> {
    return Number(await this.reader.call("get_kill_count", [matchId]));
  }

  async getKill(
    matchId: number | bigint,
    index: number,
  ): Promise<{ commitment: bigint; victimSeat: number; round: number; validated: boolean }> {
    const raw = (await this.reader.call("get_kill", [matchId, index])) as Record<string, unknown>;
    return {
      commitment: BigInt(raw.commitment as string),
      victimSeat: Number(raw.victim_seat),
      round: Number(raw.round),
      validated: Boolean(raw.validated),
    };
  }

  /** Null rather than a revert when the commitment is not in this match. */
  async getSeatIndexFor(matchId: number | bigint, commitment: bigint): Promise<number | null> {
    try {
      return Number(await this.reader.call("get_seat_index", [matchId, commitment]));
    } catch {
      return null;
    }
  }

  async treasury(): Promise<bigint> {
    return BigInt((await this.reader.call("treasury")) as string);
  }

  // ── keeper writes ──────────────────────────────────────────────────────────────────

  async createMatch(args: {
    stakeAmount: bigint;
    seatCount: number;
    rounds: number;
    impostorBps: number;
    detectiveBps: number;
    protocolBps: number;
    seedCommitment: bigint;
  }): Promise<{ matchId: number; txHash: string }> {
    const before = await this.matchCount();
    const tx = await this.mustWrite().invoke("create_match", [
      args.stakeAmount,
      args.seatCount,
      args.rounds,
      args.impostorBps,
      args.detectiveBps,
      args.protocolBps,
      args.seedCommitment,
    ]);
    const txHash = await settle(this.provider, tx);
    return { matchId: before + 1, txHash };
  }

  async fillAgentSeat(matchId: number, seatCommitment: bigint): Promise<string> {
    const tx = await this.mustWrite().invoke("fill_agent_seat", [matchId, seatCommitment]);
    return settle(this.provider, tx);
  }

  async startMatch(matchId: number, operatorSeed: bigint): Promise<string> {
    const tx = await this.mustWrite().invoke("start_match", [matchId, operatorSeed]);
    return settle(this.provider, tx);
  }

  async endPlay(matchId: number, roundsPlayed: number): Promise<string> {
    const tx = await this.mustWrite().invoke("end_play", [matchId, roundsPlayed]);
    return settle(this.provider, tx);
  }

  async abortMatch(matchId: number): Promise<string> {
    const tx = await this.mustWrite().invoke("abort_match", [matchId]);
    return settle(this.provider, tx);
  }

  /**
   * Publishes a seat's role secret. Permissionless by design — knowledge of the secret is
   * the only authorisation, so a player can reveal from any address, or let the keeper do
   * it for an agent seat, without either learning anything they should not.
   */
  async revealSeat(
    matchId: number,
    roleSecret: bigint,
    claimCommitment: bigint,
  ): Promise<string> {
    const tx = await this.mustWrite().invoke("reveal_seat", [
      matchId,
      roleSecret,
      claimCommitment,
    ]);
    return settle(this.provider, tx);
  }

  async settleMatch(matchId: number): Promise<string> {
    const tx = await this.mustWrite().invoke("settle", [matchId]);
    return settle(this.provider, tx);
  }

  async fundTreasury(amount: bigint): Promise<string> {
    const tx = await this.mustWrite().invoke("fund_treasury", [amount]);
    return settle(this.provider, tx);
  }
}

/**
 * starknet.js decodes a Cairo enum as `{ variant: { Lobby: {} } }` on some paths and as a
 * plain index on others depending on the ABI shape, so normalise both.
 */
function phaseIndex(value: unknown): number {
  if (typeof value === "bigint" || typeof value === "number") return Number(value);
  const names = ["Lobby", "Playing", "Revealing", "Settled", "Aborted"];
  const record = value as { variant?: Record<string, unknown> } | Record<string, unknown>;
  const variant = (record as { variant?: Record<string, unknown> }).variant ?? record;
  for (let i = 0; i < names.length; i += 1) {
    if (variant && Object.prototype.hasOwnProperty.call(variant, names[i])) return i;
  }
  return 0;
}
