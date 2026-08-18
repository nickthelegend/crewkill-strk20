import type { ProofWithPublicInputs } from '../types.js';

/**
 * Convert a proof + public inputs + VK into Starknet calldata
 * using the garaga npm package.
 */
export async function proofToCalldata(
  proof: ProofWithPublicInputs,
  vk: Uint8Array,
): Promise<string[]> {
  // Dynamic import for garaga WASM (no type declarations available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const garaga: any = await import('garaga');
  if (typeof garaga.init === 'function') {
    await garaga.init();
  }

  const flatPublicInputs = flattenFieldsAsArray(proof.publicInputs);
  const callData = garaga.getZKHonkCallData(proof.proof, flatPublicInputs, vk);

  // Garaga returns the full calldata; the first element is the array length prefix
  // for Starknet. The verifier contract expects calldata.slice(1).
  return Array.from(callData as ArrayLike<unknown>).map(String).slice(1);
}

/**
 * Flatten public input field elements (hex strings) into a single Uint8Array.
 * Each field is converted to a 32-byte big-endian representation.
 */
export function flattenFieldsAsArray(fields: string[]): Uint8Array {
  const arrays = fields.map(hexToUint8Array);
  const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function hexToUint8Array(hex: string): Uint8Array {
  const sanitised = BigInt(hex).toString(16).padStart(64, '0');
  const len = sanitised.length / 2;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8[i] = parseInt(sanitised.slice(i * 2, i * 2 + 2), 16);
  }
  return u8;
}
