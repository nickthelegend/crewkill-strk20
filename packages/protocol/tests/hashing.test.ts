/**
 * Cross-language pin.
 *
 * The vectors below are also asserted, byte for byte, in
 * `cairo/tests/test_hash_vectors.cairo`. If a Poseidon call, a tag, or an argument order
 * drifts on either side, one of the two suites goes red before a player ever finds out the
 * hard way — by being unable to claim.
 */

import { describe, expect, it } from "vitest";
import {
  claimCommitment,
  drawIsImpostor,
  finalSeed,
  killCommitment,
  randomFelt,
  roleDraw,
  seatCommitment,
  seedCommitment,
  voteReceipt,
} from "../src/hashing.js";

const ROLE_SECRET = 111n;
const CLAIM_SECRET = 222n;
const OPERATOR_SEED = 333n;

describe("commitment vectors (pinned against Cairo)", () => {
  it("claim commitment", () => {
    expect(claimCommitment(CLAIM_SECRET)).toBe(
      0x336f8495b2d8a30911f6e1792fb0f13f9831eec163c551664bf1e5b602028ecn,
    );
  });

  it("seat commitment", () => {
    expect(seatCommitment(ROLE_SECRET, claimCommitment(CLAIM_SECRET))).toBe(
      0x51e5caffcc667f24e161be33d7930ef6fa75ed4be72877ff481028dc7fda73cn,
    );
  });

  it("seed commitment", () => {
    expect(seedCommitment(OPERATOR_SEED)).toBe(
      0x371c563211071964e54e16ae8db2f45bcacc89e0982d9abd541a25362ec5e67n,
    );
  });

  it("final seed", () => {
    expect(finalSeed(OPERATOR_SEED, [1n, 2n, 3n])).toBe(
      0x295e7b07295b9cb72f60ac895d3ae23a4e29d32d68457badd7bf52a7eaeaf51n,
    );
  });

  it("role draw", () => {
    expect(roleDraw(99n, ROLE_SECRET)).toBe(
      0x2c4bcc0a0e969b7e22c10a7501d549d2eaac724b6c0a9c8bf65b3b2099a56aen,
    );
  });

  it("vote receipt", () => {
    expect(voteReceipt(ROLE_SECRET, 2, 3)).toBe(
      0x76dac4132424fa8813f469a0c0b84d1240b4f02e5c77c66b036ef872e9cc377n,
    );
  });

  it("kill commitment", () => {
    expect(killCommitment(ROLE_SECRET, 1, 4)).toBe(
      0x32e4661c0df679bfa89e6c94bbb30f9f49dcbd5a60e7b894bebaa7f5cadefadn,
    );
  });
});

describe("role draw band", () => {
  it("splits on the low four decimal digits", () => {
    expect(drawIsImpostor(12345n, 5000)).toBe(true); // 2345 < 5000
    expect(drawIsImpostor(12345n, 2000)).toBe(false); // 2345 >= 2000
    expect(drawIsImpostor(10000n, 1)).toBe(true); // 0 < 1
  });

  it("lands close to the configured rate over many draws", () => {
    const bps = 2500;
    let impostors = 0;
    const n = 4000;
    for (let i = 0; i < n; i += 1) {
      if (drawIsImpostor(roleDraw(BigInt(i) * 7919n + 13n, BigInt(i) + 1n), bps)) {
        impostors += 1;
      }
    }
    const rate = impostors / n;
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.28);
  });
});

describe("secret generation", () => {
  it("produces distinct in-range field elements", () => {
    const seen = new Set<bigint>();
    for (let i = 0; i < 200; i += 1) {
      const value = randomFelt();
      expect(value).toBeGreaterThan(0n);
      expect(value).toBeLessThan(
        0x800000000000011000000000000000000000000000000000000000000000001n,
      );
      seen.add(value);
    }
    expect(seen.size).toBe(200);
  });
});
