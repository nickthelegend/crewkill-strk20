/**
 * How a seat acts *through* the privacy pool.
 *
 * Every player-side action in CrewKill — buying a seat, casting a ballot, collecting a
 * payout — reaches the game contract from inside a pool transaction, so the game never sees
 * an address. This module is the seam between the two ways of arranging that:
 *
 *   • `MockPoolSeat` drives CrewKill's own pool contract on a local devnet. Real signed
 *     transactions on a real chain, but the pool is ours, so no proving service is needed.
 *     This is what makes a full match runnable end to end on a laptop.
 *
 * Against the live STRK20 pool there is deliberately no server-side implementation here.
 * Human seats need none: the browser drives the user's own privacy wallet, so viewing keys
 * never reach this process. House agents on a real pool would need
 * `@starkware-libs/starknet-privacy-sdk` plus a proving service, a discovery indexer and a
 * viewing key — operator credentials this repository does not carry. Rather than ship a code
 * path nobody has run against a real pool, the keeper checks for those endpoints at boot and
 * disables agents with an explicit warning if they are missing. See `docs/DEPLOYING.md`.
 *
 * Browsers never use either: they go through the user's own privacy wallet
 * (`account.strk20InvokeTransaction`), so viewing keys stay in the wallet. See
 * `apps/web/src/lib/strk20.ts`.
 */

import { BallotKind, CrewKillOperation } from "@crewkill/protocol";
import type { Account, RpcProvider } from "starknet";
import { contractAt, settle } from "./client.js";

export interface BallotArgs {
  matchId: number;
  commitment: bigint;
  kind: BallotKind;
  round: number;
  targetSeat: number;
}

/** One seat's ability to act privately. */
export interface SeatWallet {
  readonly label: string;
  /** Shield `amount` of the stake token so the seat can pay for itself. */
  shield(amount: bigint): Promise<string>;
  joinSeat(matchId: number, seatCommitment: bigint, stake: bigint): Promise<string>;
  castBallot(args: BallotArgs): Promise<string>;
  claim(matchId: number, claimSecret: bigint): Promise<string>;
  shieldedBalance(token: string): Promise<bigint>;
}

/** Devnet: CrewKill's own pool contract, driven with real signed transactions. */
export class MockPoolSeat implements SeatWallet {
  /**
   * One account, one transaction at a time.
   *
   * A seat can want to do two things at once — finish a night action while the meeting bell
   * is already ringing — and two transactions from one account race for the same nonce. The
   * loser does not fail cleanly; it sits in a retry loop and takes the whole keeper with it.
   * Queueing per wallet removes the race rather than papering over it.
   */
  private queue: Promise<unknown> = Promise.resolve();

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    // Keep the chain alive after a failure, but do not swallow the error for the caller.
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  constructor(
    readonly label: string,
    private readonly account: Account,
    private readonly provider: RpcProvider,
    private readonly poolAddress: string,
    private readonly gameAddress: string,
    private readonly stakeToken: string,
    private readonly ballotToken: string,
  ) {}

  async shield(amount: bigint): Promise<string> {
    return this.serialize(async () => {
      const token = contractAt("MockERC20", this.stakeToken, this.provider, this.account);
      await settle(this.provider, await token.invoke("mint", [this.account.address, amount]));
      await settle(this.provider, await token.invoke("approve", [this.poolAddress, amount]));
      const pool = contractAt("MockPrivacyPool", this.poolAddress, this.provider, this.account);
      return settle(this.provider, await pool.invoke("deposit", [this.stakeToken, amount]));
    });
  }

  async shieldedBalance(token: string): Promise<bigint> {
    const pool = contractAt("MockPrivacyPool", this.poolAddress, this.provider);
    return BigInt(
      (await pool.call("shielded_balance", [this.account.address, token])) as string,
    );
  }

  private async invoke(
    inToken: string,
    inAmount: bigint,
    operation: CrewKillOperation,
    matchId: number,
    commitment: bigint,
    kind: BallotKind,
    round: number,
    targetSeat: number,
    secret: bigint,
    noteId: bigint,
  ): Promise<string> {
    // Hand-built calldata rather than the ABI encoder: a field-free Cairo enum serialises
    // to nothing but its variant index, and going through `CairoCustomEnum` here would add
    // a layer that can only get this wrong.
    const calldata = [
      this.gameAddress,
      inToken,
      inAmount.toString(), // u128 - single felt
      this.account.address,
      operation.toString(),
      matchId.toString(),
      commitment.toString(),
      kind.toString(),
      round.toString(),
      targetSeat.toString(),
      secret.toString(),
      noteId.toString(),
    ];
    return this.serialize(async () => {
      const tx = await this.account.execute(
        { contractAddress: this.poolAddress, entrypoint: "invoke", calldata },
        { tip: 0n },
      );
      return settle(this.provider, tx);
    });
  }

  async joinSeat(matchId: number, seatCommitment: bigint, stake: bigint): Promise<string> {
    return this.invoke(
      this.stakeToken,
      stake,
      CrewKillOperation.JoinSeat,
      matchId,
      seatCommitment,
      BallotKind.Vote,
      0,
      0,
      0n,
      noteIdFor("join", matchId, seatCommitment),
    );
  }

  async castBallot(args: BallotArgs): Promise<string> {
    return this.invoke(
      this.ballotToken,
      1n,
      CrewKillOperation.CastBallot,
      args.matchId,
      args.commitment,
      args.kind,
      args.round,
      args.targetSeat,
      0n,
      0n,
    );
  }

  async claim(matchId: number, claimSecret: bigint): Promise<string> {
    return this.invoke(
      this.stakeToken,
      0n,
      CrewKillOperation.Claim,
      matchId,
      0n,
      BallotKind.Vote,
      0,
      0,
      claimSecret,
      noteIdFor("claim", matchId, claimSecret),
    );
  }
}

/** Open-note identifiers only need to be unique within a transaction. */
function noteIdFor(kind: string, matchId: number, salt: bigint): bigint {
  let hash = 0n;
  for (const char of kind) hash = hash * 131n + BigInt(char.charCodeAt(0));
  return (hash * 1_000_003n + BigInt(matchId) * 97n + (salt % 1_000_003n)) % (2n ** 200n);
}
