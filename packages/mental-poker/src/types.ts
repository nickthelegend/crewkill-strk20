/** A point on the Grumpkin curve (affine coordinates). */
export interface Point {
  x: bigint;
  y: bigint;
}

/** An ElGamal ciphertext: two curve points. */
export interface EncryptedCard {
  c1: Point;
  c2: Point;
}

/** A key pair for a player. */
export interface KeyPair {
  secretKey: bigint;
  publicKey: Point;
}

/** Proof output from NoirJS + bb.js. */
export interface ProofWithPublicInputs {
  proof: Uint8Array;
  publicInputs: string[];
}

/** Game state enum matching Cairo contract. */
export enum GameState {
  Created = 0,
  Registration = 1,
  Shuffle = 2,
  Deal = 3,
  Complete = 4,
}

/** Configuration for the SDK. */
export interface SDKConfig {
  /** Path to circuit artifacts directory (circuits/target/) */
  circuitArtifactsPath?: string;
  /** Number of Web Worker threads for proof generation */
  threads?: number;
  /** Path to barretenberg WASM file (for browser environments where dynamic import fails) */
  wasmPath?: string;
  /** RPC URL for waiting on tx confirmations (needed for Cartridge Controller which lacks waitForTransaction) */
  rpcUrl?: string;
}

// ── Poker types ──────────────────────────────────────────────

/** Poker phase enum matching Cairo contract. */
export enum PokerPhase {
  None = 0,
  PreFlop = 1,
  Flop = 2,
  Turn = 3,
  River = 4,
  Showdown = 5,
}

/** Player action enum matching Cairo contract. */
export enum PlayerAction {
  None = 0,
  Fold = 1,
  Check = 2,
  Call = 3,
  Raise = 4,
  AllIn = 5,
}

/** Hand rank enum matching Cairo contract (0-9). */
export enum HandRank {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

/** Configuration for creating a poker table. */
export interface TableConfig {
  maxPlayers: number;
  deckSize?: number; // defaults to 52
  smallBlind: bigint;
  bigBlind: bigint;
  initialStack: bigint;
}

/** Result of a poker hand showdown. */
export interface PokerHandResult {
  winnerIndex: number;
  winnerAmount: bigint;
}
