/**
 * How the browser reaches the CrewKill contract *through* a privacy pool.
 *
 * On Sepolia and mainnet this is the STRK20 Wallet API: the app hands the wallet a list of
 * `STRK20_ACTION`s and the wallet does the proving and submission. Viewing keys never leave
 * the wallet, and the app never sees a note. This is the route STRK20 recommends for dapps
 * and it is the one CrewKill ships.
 *
 * On a local devnet no privacy wallet exists, so the same operations run against CrewKill's
 * own pool contract signed by a predeployed devnet key. Those are real signed transactions
 * on a real chain — the pool is simply ours rather than StarkWare's.
 */

import { BallotKind, CrewKillOperation } from "@crewkill/protocol";
import { Account, RpcProvider } from "starknet";
import type { ChainConfig } from "./api";

export interface SeatAction {
  matchId: number;
  commitment: bigint;
  kind: BallotKind;
  round: number;
  targetSeat: number;
}

export interface PoolClient {
  readonly kind: "wallet-api" | "devnet";
  readonly address: string;
  joinSeat(matchId: number, seatCommitment: bigint, stake: bigint): Promise<string>;
  castBallot(action: SeatAction): Promise<string>;
  claim(matchId: number, claimSecret: bigint): Promise<string>;
  /** Shield stake so the seat can be paid for. Two transactions on a real pool. */
  shield(amount: bigint): Promise<string>;
}

/** The calldata `privacy_invoke` expects, in declaration order. */
function invokeCalldata(
  operation: CrewKillOperation,
  matchId: number,
  commitment: bigint,
  kind: BallotKind,
  round: number,
  targetSeat: number,
  secret: bigint,
  noteId: bigint,
): string[] {
  return [
    operation.toString(),
    matchId.toString(),
    commitment.toString(),
    kind.toString(),
    round.toString(),
    targetSeat.toString(),
    secret.toString(),
    noteId.toString(),
  ];
}

function noteId(salt: bigint): bigint {
  return salt % 2n ** 200n || 1n;
}

// ── the real thing: STRK20 Wallet API ────────────────────────────────────────────────

/** The wallet-side surface CrewKill uses. Wallet API >= 0.10.3 exposes these. */
interface Strk20WalletAccount {
  address: string;
  strk20InvokeTransaction(actions: unknown[]): Promise<{ transaction_hash: string }>;
  strk20PrepareInvoke?(actions: unknown[], dryRun: boolean): Promise<unknown>;
  strk20Balances?(tokens: string[]): Promise<Array<{ token: string; balance: string }>>;
}

export class WalletApiPool implements PoolClient {
  readonly kind = "wallet-api" as const;

  constructor(
    private readonly wallet: Strk20WalletAccount,
    private readonly config: ChainConfig,
  ) {}

  get address(): string {
    return this.wallet.address;
  }

  /**
   * Shielding is two transactions — the ERC-20 approve has to land before the private
   * deposit, because the pool's `apply_actions` is reentrancy-guarded against sharing one.
   * The wallet prompts twice; the UI labels both so the second does not read as a bug.
   */
  async shield(amount: bigint): Promise<string> {
    const { transaction_hash } = await this.wallet.strk20InvokeTransaction([
      { type: "deposit", token: this.config.contracts.stakeToken, amount: amount.toString() },
    ]);
    return transaction_hash;
  }

  /**
   * Buying a seat: one `invoke` action. The pool withdraws the stake to the CrewKill
   * anonymizer, calls `privacy_invoke`, and credits the ballot notes it returns into the
   * open note opened by the first action — atomically. Observers see the pool pay the game
   * contract; they never see who asked for it.
   */
  async joinSeat(matchId: number, seatCommitment: bigint, stake: bigint): Promise<string> {
    const { transaction_hash } = await this.wallet.strk20InvokeTransaction([
      // The note the ballots get credited into. Its amount is public; its owner is not.
      { type: "transfer", token: this.config.contracts.ballot, amount: "OPEN", recipient: this.address },
      {
        type: "invoke",
        contract: this.config.contracts.game,
        amount: stake.toString(),
        token: this.config.contracts.stakeToken,
        calldata: invokeCalldata(
          CrewKillOperation.JoinSeat,
          matchId,
          seatCommitment,
          BallotKind.Vote,
          0,
          0,
          0n,
          0n,
        ).map((value, index) => (index === 7 ? "${openNoteIds[0]}" : value)),
      },
    ]);
    return transaction_hash;
  }

  /** A vote or night action: spend exactly one ballot note. Returns no open note. */
  async castBallot(action: SeatAction): Promise<string> {
    const { transaction_hash } = await this.wallet.strk20InvokeTransaction([
      {
        type: "invoke",
        contract: this.config.contracts.game,
        amount: "1",
        token: this.config.contracts.ballot,
        calldata: invokeCalldata(
          CrewKillOperation.CastBallot,
          action.matchId,
          action.commitment,
          action.kind,
          action.round,
          action.targetSeat,
          0n,
          0n,
        ),
      },
    ]);
    return transaction_hash;
  }

  async claim(matchId: number, claimSecret: bigint): Promise<string> {
    const { transaction_hash } = await this.wallet.strk20InvokeTransaction([
      { type: "transfer", token: this.config.contracts.stakeToken, amount: "OPEN", recipient: this.address },
      {
        type: "invoke",
        contract: this.config.contracts.game,
        calldata: invokeCalldata(
          CrewKillOperation.Claim,
          matchId,
          0n,
          BallotKind.Vote,
          0,
          0,
          claimSecret,
          0n,
        ).map((value, index) => (index === 7 ? "${openNoteIds[0]}" : value)),
      },
    ]);
    return transaction_hash;
  }
}

// ── local devnet ─────────────────────────────────────────────────────────────────────

/**
 * Signs with a predeployed devnet key against CrewKill's own pool contract.
 *
 * Real signatures, real receipts, real state — just a chain that costs nothing, so a whole
 * match can be played on a laptop without a privacy wallet or mainnet STRK.
 */
export class DevnetPool implements PoolClient {
  readonly kind = "devnet" as const;
  private readonly provider: RpcProvider;
  private readonly account: Account;

  constructor(
    private readonly config: ChainConfig,
    address: string,
    privateKey: string,
  ) {
    this.provider = new RpcProvider({ nodeUrl: config.rpcUrl });
    this.account = new Account({
      provider: this.provider,
      address,
      signer: privateKey,
      cairoVersion: "1",
    });
  }

  get address(): string {
    return this.account.address;
  }

  private async send(calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>) {
    const tx = await this.account.execute(calls, { tip: 0n });
    await this.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 400 });
    return tx.transaction_hash;
  }

  async shield(amount: bigint): Promise<string> {
    return this.send([
      {
        contractAddress: this.config.contracts.stakeToken,
        entrypoint: "mint",
        calldata: [this.address, amount.toString(), "0"],
      },
      {
        contractAddress: this.config.contracts.stakeToken,
        entrypoint: "approve",
        calldata: [this.config.contracts.pool, amount.toString(), "0"],
      },
      {
        contractAddress: this.config.contracts.pool,
        entrypoint: "deposit",
        calldata: [this.config.contracts.stakeToken, amount.toString()],
      },
    ]);
  }

  private poolInvoke(
    inToken: string,
    inAmount: bigint,
    calldata: string[],
  ): Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> {
    return [
      {
        contractAddress: this.config.contracts.pool,
        entrypoint: "invoke",
        calldata: [
          this.config.contracts.game,
          inToken,
          inAmount.toString(),
          this.address,
          ...calldata,
        ],
      },
    ];
  }

  async joinSeat(matchId: number, seatCommitment: bigint, stake: bigint): Promise<string> {
    return this.send(
      this.poolInvoke(
        this.config.contracts.stakeToken,
        stake,
        invokeCalldata(
          CrewKillOperation.JoinSeat,
          matchId,
          seatCommitment,
          BallotKind.Vote,
          0,
          0,
          0n,
          noteId(seatCommitment),
        ),
      ),
    );
  }

  async castBallot(action: SeatAction): Promise<string> {
    return this.send(
      this.poolInvoke(
        this.config.contracts.ballot,
        1n,
        invokeCalldata(
          CrewKillOperation.CastBallot,
          action.matchId,
          action.commitment,
          action.kind,
          action.round,
          action.targetSeat,
          0n,
          0n,
        ),
      ),
    );
  }

  async claim(matchId: number, claimSecret: bigint): Promise<string> {
    return this.send(
      this.poolInvoke(
        this.config.contracts.stakeToken,
        0n,
        invokeCalldata(
          CrewKillOperation.Claim,
          matchId,
          0n,
          BallotKind.Vote,
          0,
          0,
          claimSecret,
          noteId(claimSecret),
        ),
      ),
    );
  }
}

/**
 * Connects the user's privacy-enabled wallet.
 *
 * Capability is detected with a version query rather than by probing a balance method —
 * `strk20Balances` is gated behind a consent prompt for data the app has no business seeing.
 */
export async function connectWallet(config: ChainConfig): Promise<PoolClient> {
  const { connect } = await import("@starknet-io/get-starknet");
  const wallet = (await connect({ modalMode: "alwaysAsk" })) as unknown as
    | (Strk20WalletAccount & { enable?: () => Promise<void> })
    | null;
  if (!wallet) throw new Error("No wallet selected.");
  await wallet.enable?.();
  if (typeof wallet.strk20InvokeTransaction !== "function") {
    throw new Error(
      "This wallet does not support STRK20 (Wallet API 0.10.3+). Ready and Xverse do.",
    );
  }
  return new WalletApiPool(wallet, config);
}

/** Reads a seat index straight off the contract, so joining needs no server round-trip. */
export async function lookupSeatIndex(
  config: ChainConfig,
  matchId: number,
  seatCommitment: bigint,
): Promise<number | null> {
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  try {
    const result = await provider.callContract({
      contractAddress: config.contracts.game,
      entrypoint: "get_seat_index",
      calldata: [matchId.toString(), seatCommitment.toString()],
    });
    return Number(BigInt(result[0]));
  } catch {
    return null;
  }
}
