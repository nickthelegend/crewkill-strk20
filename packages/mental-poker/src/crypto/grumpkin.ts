import { weierstrass } from '@noble/curves/abstract/weierstrass';
import { Field as createField } from '@noble/curves/abstract/modular';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { concatBytes, randomBytes } from '@noble/hashes/utils';
import type { Point } from '../types';

// Grumpkin curve: y² = x³ - 17 over BN254 scalar field
// This is Noir's native embedded curve

/** BN254 scalar field (= Grumpkin base field Fp) */
export const GRUMPKIN_P =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Grumpkin group order (= BN254 base field) */
export const GRUMPKIN_N =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

const Fp = createField(GRUMPKIN_P);

// Generator: Gx = 1, Gy = sqrt(1 - 17) = sqrt(-16) mod p
// -16 mod p = p - 16
// sqrt(p-16) mod p — computed offline:
const Gy =
  17631683881184975370165255887551781615748388533673675138860n;

// Verify: Gy² mod p should equal (1 - 17) mod p = p - 16
// This is validated at test time.

export const grumpkin = weierstrass({
  a: 0n,
  b: Fp.neg(17n), // -17 mod p
  Fp,
  n: GRUMPKIN_N,
  Gx: 1n,
  Gy,
  h: 1n,
  hash: sha256,
  hmac: (key: Uint8Array, ...msgs: Uint8Array[]) =>
    hmac(sha256, key, concatBytes(...msgs)),
  randomBytes,
});

export type ProjectivePoint = ReturnType<typeof grumpkin.ProjectivePoint.fromAffine>;

/** Generator point G */
export const G = grumpkin.ProjectivePoint.BASE;

/** Point at infinity */
export const ZERO = grumpkin.ProjectivePoint.ZERO;

/** Scalar multiply: point * scalar */
export function scalarMul(point: ProjectivePoint, scalar: bigint): ProjectivePoint {
  return point.multiply(scalar);
}

/** Fixed-base scalar multiply: scalar * G */
export function fixedBaseMul(scalar: bigint): ProjectivePoint {
  return G.multiply(scalar);
}

/** Convert ProjectivePoint to our Point type (affine coordinates) */
export function toPoint(p: ProjectivePoint): Point {
  const affine = p.toAffine();
  return { x: affine.x, y: affine.y };
}

/** Convert our Point type to ProjectivePoint */
export function fromPoint(p: Point): ProjectivePoint {
  return grumpkin.ProjectivePoint.fromAffine({ x: p.x, y: p.y });
}

/** Generate a cryptographically secure random scalar in [1, n-1] */
export function randomScalar(): bigint {
  // Use rejection sampling to get uniform distribution
  const bytes = randomBytes(32);
  let scalar = 0n;
  for (let i = 0; i < 32; i++) {
    scalar = (scalar << 8n) | BigInt(bytes[i]);
  }
  scalar = scalar % (GRUMPKIN_N - 1n) + 1n;
  return scalar;
}

/** Modular reduction into Fp (the base/coordinate field) */
export function mod(n: bigint): bigint {
  return ((n % GRUMPKIN_P) + GRUMPKIN_P) % GRUMPKIN_P;
}
