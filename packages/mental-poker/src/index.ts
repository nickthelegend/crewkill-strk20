// Types
export type {
  Point,
  EncryptedCard,
  KeyPair,
  ProofWithPublicInputs,
  GameState,
  SDKConfig,
} from './types.js';

// High-level SDK
export { MentalPokerSDK } from './mental-poker-sdk.js';

// Crypto layer
export {
  generateKeyPair,
  privToPubKey,
  encrypt,
  remask,
  computeRevealToken,
  decryptWithTokens,
  computeAggregateKey,
  encryptDeck,
  buildCardTable,
  lookupCard,
  shuffleAndRemask,
  randomPermutation,
} from './crypto/elgamal.js';

// Grumpkin curve primitives
export {
  grumpkin,
  G,
  ZERO,
  GRUMPKIN_P,
  GRUMPKIN_N,
  fixedBaseMul,
  scalarMul,
  toPoint,
  fromPoint,
  randomScalar,
} from './crypto/grumpkin.js';

// Proof generation
export { MentalPokerProver } from './proof/prover.js';
export { proofToCalldata, flattenFieldsAsArray } from './proof/calldata.js';

// Contract wrappers
export { MentalPokerContract } from './contract/mental-poker.js';
export { TexasHoldemContract } from './contract/texas-holdem.js';

// Poker SDK
export { TexasHoldemSDK } from './texas-holdem-sdk.js';

// Poker types
export type { TableConfig, PokerHandResult } from './types.js';
export { PokerPhase, PlayerAction, HandRank } from './types.js';

// Poker utilities
export { cardToRankSuit, cardName, handDescription } from './poker/card-mapping.js';
export type { CardInfo } from './poker/card-mapping.js';
