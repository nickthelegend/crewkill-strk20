/**
 * Mental poker: dealing cards with no dealer.
 *
 * Ported from the mental-poker reference in `_references/`, which built it for the Starknet
 * privacy track. Only the cryptography came across. The reference also proves its shuffles
 * in Noir and verifies them on-chain through Garaga, and that layer is not here yet, so what
 * this package gives you is the encryption and the threshold reveal, not a proof that a
 * shuffle was honest.
 *
 * The property that matters: a card is encrypted to an aggregate key that no single player
 * holds. Opening it needs a reveal token from every player. One player alone, including
 * whoever runs the table, learns nothing.
 */

export {
  GRUMPKIN_N,
  G,
  ZERO,
  scalarMul,
  fixedBaseMul,
  toPoint,
  fromPoint,
  randomScalar,
  mod,
  type ProjectivePoint,
} from "./crypto/grumpkin";

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
} from "./crypto/elgamal";

export type { Point, EncryptedCard, KeyPair } from "./types";
