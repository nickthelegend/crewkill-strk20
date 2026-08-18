import type { Point, EncryptedCard, ProofWithPublicInputs } from '../types.js';
import type { InputMap } from '@noir-lang/types';

// These are dynamically imported to support both browser and Node.js
type UltraHonkBackend = InstanceType<typeof import('@aztec/bb.js').UltraHonkBackend>;

interface CircuitArtifact {
  bytecode: string;
  abi: { parameters: unknown[] };
}

/**
 * Proof generator wrapping NoirJS + bb.js.
 * Loads circuit artifacts and generates proofs for all 3 circuit types.
 */
export class MentalPokerProver {
  private circuits: Map<string, CircuitArtifact> = new Map();
  private backends: Map<string, UltraHonkBackend> = new Map();
  private threads: number;
  private wasmPath?: string;

  constructor(threads = 2, wasmPath?: string) {
    this.threads = threads;
    this.wasmPath = wasmPath;
  }

  /**
   * Load a circuit artifact from a JSON object (compiled Noir circuit).
   */
  loadCircuit(name: string, artifact: CircuitArtifact): void {
    this.circuits.set(name, artifact);
  }

  /**
   * Generate a proof for the given circuit with the given inputs.
   */
  private async generateProof(
    circuitName: string,
    inputs: InputMap,
  ): Promise<ProofWithPublicInputs> {
    const artifact = this.circuits.get(circuitName);
    if (!artifact) {
      throw new Error(`Circuit '${circuitName}' not loaded. Call loadCircuit() first.`);
    }

    const { Noir } = await import('@noir-lang/noir_js');
    const { UltraHonkBackend } = await import('@aztec/bb.js');

    // Generate witness
    const noir = new Noir({ bytecode: artifact.bytecode, abi: artifact.abi } as never);
    const { witness } = await noir.execute(inputs);

    // Generate proof
    let backend = this.backends.get(circuitName);
    if (!backend) {
      const opts: Record<string, unknown> = { threads: this.threads };
      if (this.wasmPath) opts.wasmPath = this.wasmPath;
      backend = new UltraHonkBackend(artifact.bytecode, opts as never);
      this.backends.set(circuitName, backend);
    }
    const proof = await backend.generateProof(witness, { keccakZK: true });

    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs as string[],
    };
  }

  /**
   * Prove knowledge of secret key: pk == sk * G.
   * Public inputs: [public_key_x, public_key_y]
   */
  async proveKeyOwnership(
    secretKey: bigint,
    publicKey: Point,
  ): Promise<ProofWithPublicInputs> {
    return this.generateProof('key_ownership', {
      public_key_x: toHex(publicKey.x),
      public_key_y: toHex(publicKey.y),
      secret_key: toHex(secretKey),
    });
  }

  /**
   * Prove correct computation of a reveal token.
   * Public inputs: [c1_x, c1_y, reveal_token_x, reveal_token_y, public_key_x, public_key_y]
   */
  async proveDecrypt(
    secretKey: bigint,
    c1: Point,
    revealToken: Point,
    publicKey: Point,
  ): Promise<ProofWithPublicInputs> {
    return this.generateProof('decrypt_card', {
      c1_x: toHex(c1.x),
      c1_y: toHex(c1.y),
      reveal_token_x: toHex(revealToken.x),
      reveal_token_y: toHex(revealToken.y),
      public_key_x: toHex(publicKey.x),
      public_key_y: toHex(publicKey.y),
      secret_key: toHex(secretKey),
    });
  }

  /**
   * Prove correct shuffle and re-encryption of the deck.
   * Public inputs: 8 arrays of deck coordinates + APK point.
   */
  async proveShuffle(
    deckIn: EncryptedCard[],
    deckOut: EncryptedCard[],
    aggregatePk: Point,
    permutation: number[],
    randomness: bigint[],
    deckSize: number,
  ): Promise<ProofWithPublicInputs> {
    const circuitName = getShuffleCircuitName(deckSize);

    return this.generateProof(circuitName, {
      deck_in_c1_x: deckIn.map((c) => toHex(c.c1.x)),
      deck_in_c1_y: deckIn.map((c) => toHex(c.c1.y)),
      deck_in_c2_x: deckIn.map((c) => toHex(c.c2.x)),
      deck_in_c2_y: deckIn.map((c) => toHex(c.c2.y)),
      deck_out_c1_x: deckOut.map((c) => toHex(c.c1.x)),
      deck_out_c1_y: deckOut.map((c) => toHex(c.c1.y)),
      deck_out_c2_x: deckOut.map((c) => toHex(c.c2.x)),
      deck_out_c2_y: deckOut.map((c) => toHex(c.c2.y)),
      aggregate_pk_x: toHex(aggregatePk.x),
      aggregate_pk_y: toHex(aggregatePk.y),
      permutation: permutation.map((p) => `0x${p.toString(16)}`),
      randomness: randomness.map(toHex),
    });
  }

  /**
   * Clean up backend resources.
   */
  async destroy(): Promise<void> {
    for (const backend of this.backends.values()) {
      await (backend as { destroy?: () => Promise<void> }).destroy?.();
    }
    this.backends.clear();
  }
}

function getShuffleCircuitName(deckSize: number): string {
  switch (deckSize) {
    case 52:
      return 'shuffle_encrypt';
    default:
      throw new Error(`Unsupported deck size: ${deckSize}. Only 52 is supported.`);
  }
}

function toHex(n: bigint): string {
  return '0x' + n.toString(16);
}
