/**
 * The claim this package makes is that no single player can read a card.
 *
 * These tests are written to try to break that, not to demonstrate the happy path. A test
 * suite that only shows decryption working would pass just as happily against a scheme
 * where one key opened everything.
 */

import { describe, expect, it } from "vitest";
import {
  computeAggregateKey,
  computeRevealToken,
  decryptWithTokens,
  encrypt,
  generateKeyPair,
  randomScalar,
  remask,
  fixedBaseMul,
  toPoint,
} from "../src/index.js";
import type { Point } from "../src/types.js";

/** A table of n players, each holding a key nobody else has. */
function table(n: number) {
  const players = Array.from({ length: n }, () => generateKeyPair());
  const aggregate = computeAggregateKey(players.map((p) => p.publicKey));
  return { players, aggregate };
}

/** Cards are points; this is the point for a given card index. */
const cardPoint = (index: number): Point => toPoint(fixedBaseMul(BigInt(index + 1)));

describe("threshold reveal", () => {
  it("opens a card only when every player contributes", () => {
    const { players, aggregate } = table(4);
    const card = 17;
    const sealed = encrypt(aggregate, BigInt(card + 1), randomScalar());

    const tokens = players.map((p) => computeRevealToken(p.secretKey, sealed.c1));
    const opened = decryptWithTokens(sealed.c2, tokens);

    expect(opened).toEqual(cardPoint(card));
  });

  it("does not open with one token missing", () => {
    const { players, aggregate } = table(4);
    const sealed = encrypt(aggregate, 18n, randomScalar());

    const short = players.slice(0, 3).map((p) => computeRevealToken(p.secretKey, sealed.c1));
    expect(decryptWithTokens(sealed.c2, short)).not.toEqual(cardPoint(17));
  });

  it("does not open for a single player holding their own key", () => {
    const { players, aggregate } = table(5);
    const sealed = encrypt(aggregate, 9n, randomScalar());

    // The strongest form of the claim: the dealer, or anyone else, acting alone.
    for (const player of players) {
      const alone = decryptWithTokens(sealed.c2, [
        computeRevealToken(player.secretKey, sealed.c1),
      ]);
      expect(alone).not.toEqual(cardPoint(8));
    }
  });

  it("does not open with a wrong key substituted for a real one", () => {
    const { players, aggregate } = table(3);
    const sealed = encrypt(aggregate, 25n, randomScalar());
    const impostor = generateKeyPair();

    const tokens = [
      computeRevealToken(players[0].secretKey, sealed.c1),
      computeRevealToken(players[1].secretKey, sealed.c1),
      computeRevealToken(impostor.secretKey, sealed.c1),
    ];
    expect(decryptWithTokens(sealed.c2, tokens)).not.toEqual(cardPoint(24));
  });

  it("survives remasking, which is what a shuffle does to a card", () => {
    const { players, aggregate } = table(3);
    const card = 42;
    let sealed = encrypt(aggregate, BigInt(card + 1), randomScalar());

    // Each player remasks in turn, exactly as they would while shuffling.
    for (let i = 0; i < players.length; i += 1) {
      sealed = remask(sealed, randomScalar(), aggregate);
    }

    const tokens = players.map((p) => computeRevealToken(p.secretKey, sealed.c1));
    expect(decryptWithTokens(sealed.c2, tokens)).toEqual(cardPoint(card));
  });

  it("hides the card: the same card encrypts differently every time", () => {
    const { aggregate } = table(3);
    const a = encrypt(aggregate, 11n, randomScalar());
    const b = encrypt(aggregate, 11n, randomScalar());
    expect(a.c2).not.toEqual(b.c2);
  });

  it("token order does not matter", () => {
    const { players, aggregate } = table(4);
    const sealed = encrypt(aggregate, 31n, randomScalar());
    const tokens = players.map((p) => computeRevealToken(p.secretKey, sealed.c1));

    const forwards = decryptWithTokens(sealed.c2, tokens);
    const backwards = decryptWithTokens(sealed.c2, [...tokens].reverse());
    expect(forwards).toEqual(backwards);
  });

  it("scales to a full table without losing the card", () => {
    const { players, aggregate } = table(9);
    const card = 51;
    const sealed = encrypt(aggregate, BigInt(card + 1), randomScalar());
    const tokens = players.map((p) => computeRevealToken(p.secretKey, sealed.c1));
    expect(decryptWithTokens(sealed.c2, tokens)).toEqual(cardPoint(card));
  });
});
