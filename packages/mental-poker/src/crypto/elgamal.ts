import {
  G,
  ZERO,
  fixedBaseMul,
  scalarMul,
  toPoint,
  fromPoint,
  randomScalar,
  type ProjectivePoint,
} from './grumpkin.js';
import type { Point, EncryptedCard, KeyPair } from '../types.js';

/**
 * Generate a new key pair: sk random in [1, n-1], pk = sk * G.
 */
export function generateKeyPair(): KeyPair {
  const secretKey = randomScalar();
  const publicKey = toPoint(fixedBaseMul(secretKey));
  return { secretKey, publicKey };
}

/**
 * Derive public key from secret key: pk = sk * G.
 * Matches Noir's `priv_to_pub_key`.
 */
export function privToPubKey(secretKey: bigint): Point {
  return toPoint(fixedBaseMul(secretKey));
}

/**
 * Encrypt a card using exponential ElGamal.
 * cardScalar should be (card_index + 1) to avoid point at infinity.
 * Returns (r*G, cardScalar*G + r*PK).
 *
 * Matches Noir's `elgamal_encrypt`.
 */
export function encrypt(
  publicKey: Point,
  cardScalar: bigint,
  randomness: bigint,
): EncryptedCard {
  // C1 = r * G
  const c1 = fixedBaseMul(randomness);

  // C2 = cardScalar * G + r * PK
  const mG = fixedBaseMul(cardScalar);
  const rPK = scalarMul(fromPoint(publicKey), randomness);
  const c2 = mG.add(rPK);

  return {
    c1: toPoint(c1),
    c2: toPoint(c2),
  };
}

/**
 * Re-randomize an encrypted card with fresh randomness.
 * new_C1 = C1 + r * G
 * new_C2 = C2 + r * APK
 *
 * Matches Noir's `remask`.
 */
export function remask(
  card: EncryptedCard,
  randomness: bigint,
  aggregatePk: Point,
): EncryptedCard {
  const rG = fixedBaseMul(randomness);
  const rAPK = scalarMul(fromPoint(aggregatePk), randomness);

  const newC1 = fromPoint(card.c1).add(rG);
  const newC2 = fromPoint(card.c2).add(rAPK);

  return {
    c1: toPoint(newC1),
    c2: toPoint(newC2),
  };
}

/**
 * Compute reveal token: token = sk * C1.
 * Matches Noir's `compute_reveal_token`.
 */
export function computeRevealToken(secretKey: bigint, c1: Point): Point {
  return toPoint(scalarMul(fromPoint(c1), secretKey));
}

/**
 * Decrypt a card given its C2 and all reveal tokens.
 * plaintext_point = C2 - sum(reveal_tokens)
 * Returns the point (card_scalar * G).
 */
export function decryptWithTokens(c2: Point, revealTokens: Point[]): Point {
  let tokenSum: ProjectivePoint = ZERO;
  for (const token of revealTokens) {
    tokenSum = tokenSum.add(fromPoint(token));
  }
  const decrypted = fromPoint(c2).subtract(tokenSum);
  return toPoint(decrypted);
}

/**
 * Compute aggregate public key: APK = pk1 + pk2 + ... + pkN.
 */
export function computeAggregateKey(publicKeys: Point[]): Point {
  let apk: ProjectivePoint = ZERO;
  for (const pk of publicKeys) {
    apk = apk.add(fromPoint(pk));
  }
  return toPoint(apk);
}

/**
 * Encrypt a full deck of cards with the aggregate public key.
 * Card i gets card_scalar = i + 1 (to avoid point at infinity).
 * Each card gets a fresh random nonce.
 */
export function encryptDeck(
  deckSize: number,
  aggregatePk: Point,
): { deck: EncryptedCard[]; randomness: bigint[] } {
  const deck: EncryptedCard[] = [];
  const randomness: bigint[] = [];
  for (let i = 0; i < deckSize; i++) {
    const r = randomScalar();
    randomness.push(r);
    deck.push(encrypt(aggregatePk, BigInt(i + 1), r));
  }
  return { deck, randomness };
}

/**
 * Build a lookup table: maps point.x → card value (0-indexed).
 * Computes (i+1)*G for i in [0, deckSize), returns Map keyed by x coordinate as string.
 */
export function buildCardTable(deckSize: number): Map<string, number> {
  const table = new Map<string, number>();
  for (let i = 0; i < deckSize; i++) {
    const point = toPoint(fixedBaseMul(BigInt(i + 1)));
    table.set(point.x.toString(), i);
  }
  return table;
}

/**
 * Look up a decrypted point in the card table.
 * Returns the card index (0-based) or -1 if not found.
 */
export function lookupCard(
  decryptedPoint: Point,
  cardTable: Map<string, number>,
): number {
  return cardTable.get(decryptedPoint.x.toString()) ?? -1;
}

/**
 * Shuffle a deck: apply a permutation and remask each card.
 * permutation[i] = source index for output position i.
 * Returns the new deck and randomness used.
 */
export function shuffleAndRemask(
  deck: EncryptedCard[],
  permutation: number[],
  aggregatePk: Point,
): { newDeck: EncryptedCard[]; randomness: bigint[] } {
  const newDeck: EncryptedCard[] = [];
  const randomness: bigint[] = [];
  for (let i = 0; i < deck.length; i++) {
    const sourceCard = deck[permutation[i]];
    const r = randomScalar();
    randomness.push(r);
    newDeck.push(remask(sourceCard, r, aggregatePk));
  }
  return { newDeck, randomness };
}

/**
 * Generate a random permutation of [0, 1, ..., n-1] using Fisher-Yates.
 */
export function randomPermutation(n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    // Use randomScalar as entropy source, reduce mod (i+1)
    const r = randomScalar();
    const j = Number(r % BigInt(i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}
