import type { TexasHoldemSDK } from '@mental-poker/sdk';
import type { Account } from 'starknet';

export interface CardSlot {
  index: number; // deck index
  /** 0-based card value (0-51), null if face-down or not yet dealt */
  value: number | null;
  faceUp: boolean;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  phase: string;
  message: string;
  txHash?: string;
  duration?: number;
}

export interface DeployedConfig {
  url: string;
  accounts?: Record<string, { address: string; private_key: string }>; // local only
  contracts: { texas_holdem: string };
  config: { small_blind: number; big_blind: number; initial_stack: number };
}

export interface PlayerContext {
  playerNumber: number; // 1-based (1..maxPlayers)
  playerIndex: number; // 0-based (0..maxPlayers-1)
  sdk: TexasHoldemSDK;
  account: Account;
  secretKey: bigint;
  address: string;
}

/** State polled from contract */
export interface PolledState {
  // Base state (always read)
  gameState: number; // 0=Created, 1=Registration, 2=Shuffle, 3=Deal, 4=Complete
  numPlayers: number;
  maxPlayers: number;
  gameId: bigint | null;

  // Shuffle phase
  shuffleCount: number;
  currentShufflePlayer: number;

  // Deal/poker phase
  pokerPhase: number; // 0=None, 1=PreFlop, 2=Flop, 3=Turn, 4=River, 5=Showdown
  actionPlayer: number;
  pot: bigint;
  currentBet: bigint;
  stacks: bigint[];
  bets: bigint[];
  folded: boolean[];
  allIn: boolean[];

  // Card reveals — tracked per relevant card index
  reveals: Map<number, boolean[]>; // cardIndex -> [p0Revealed, p1Revealed, ..., pNRevealed]
  unmaskedCards: Map<number, number>; // cardIndex -> cardValue

  // Hole card verification (split from showdown to avoid step limit)
  verifiedHoleCards: Set<number>; // card indices that have been cryptographically verified

  // Hole cards: deck indices
  myHoleCardIndices: number[];
  otherPlayersHoleCardIndices: Map<number, number[]>; // playerIdx -> [idx0, idx1]

  // Multi-hand state
  handNumber: number;
  eliminated: boolean[];       // per original player index
  activeInHand: boolean[];     // per original player index
  numActive: number;

  // Last completed hand result (0-9 for hand rank, 0xFF for fold-win)
  lastWinnerRank?: number;
  lastWinnerAmount?: bigint;
}

export type Screen = 'lobby' | 'game' | 'results';

export interface OpenTable {
  gameId: bigint;
  numPlayers: number;
  maxPlayers: number;
  creatorAddress: string; // Starknet address of the game creator
}

/** Keyed by preset id: 'low' | 'mid' | 'high' */
export type LobbyState = Record<string, OpenTable | null>;

export interface RoomConfig {
  maxPlayers: number;
  smallBlind: bigint;
  bigBlind: bigint;
  initialStack: bigint;
}

export type PokerPhaseName = 'None' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown';

export const PHASE_NAMES: Record<number, PokerPhaseName> = {
  0: 'None',
  1: 'PreFlop',
  2: 'Flop',
  3: 'Turn',
  4: 'River',
  5: 'Showdown',
};

/** Result of a completed hand (shown between hands) */
export interface HandResult {
  handNumber: number;
  winnerIndex: number;
  amount: bigint;
  reason: 'showdown' | 'fold';
  handRank?: number; // 0-9 for showdown wins (see HAND_RANK_NAMES)
  /** Stacks after pot was awarded */
  stacks: bigint[];
  /** Cards visible at hand end (for showdown display) */
  communityCards: CardSlot[];
  holeCards: Map<number, CardSlot[]>; // playerIndex -> hole cards
}

export const HAND_RANK_NAMES: Record<number, string> = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
  9: 'Royal Flush',
};
