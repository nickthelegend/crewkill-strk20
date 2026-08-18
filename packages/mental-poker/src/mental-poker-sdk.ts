import type { Point, EncryptedCard, KeyPair, SDKConfig } from './types.js';
import {
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
import { MentalPokerProver } from './proof/prover.js';
import { proofToCalldata } from './proof/calldata.js';
import { MentalPokerContract } from './contract/mental-poker.js';

type Account = import('starknet').Account;

/**
 * High-level SDK for the Mental Poker protocol.
 * Orchestrates crypto operations, proof generation, and contract interaction.
 */
export class MentalPokerSDK {
  private prover: MentalPokerProver;
  private contract: MentalPokerContract;
  private cardTable: Map<string, number> | null = null;
  private vks: Map<string, Uint8Array> = new Map();

  private constructor(contract: MentalPokerContract, prover: MentalPokerProver) {
    this.contract = contract;
    this.prover = prover;
  }

  /**
   * Create a new SDK instance.
   * @param account - Starknet account for signing transactions
   * @param contractAddress - Address of the deployed MentalPoker contract
   * @param config - Optional configuration
   */
  static create(
    account: Account,
    contractAddress: string,
    config?: SDKConfig,
  ): MentalPokerSDK {
    const contract = new MentalPokerContract(contractAddress, account);
    const prover = new MentalPokerProver(config?.threads ?? 2, config?.wasmPath);
    return new MentalPokerSDK(contract, prover);
  }

  /**
   * Load a circuit artifact for proof generation.
   * Must be called for each circuit type before using proof-dependent methods.
   */
  loadCircuit(name: string, artifact: { bytecode: string; abi: unknown }): void {
    this.prover.loadCircuit(name, artifact as never);
  }

  /**
   * Load a verification key for calldata generation.
   * @param circuitName - Name of the circuit (e.g., 'key_ownership')
   * @param vk - The VK binary data
   */
  loadVk(circuitName: string, vk: Uint8Array): void {
    this.vks.set(circuitName, vk);
  }

  // ── Key management ─────────────────────────────────────────

  /** Generate a new key pair. */
  generateKeyPair(): KeyPair {
    return generateKeyPair();
  }

  /** Derive public key from secret key. */
  getPublicKey(secretKey: bigint): Point {
    return privToPubKey(secretKey);
  }

  // ── Game flow ──────────────────────────────────────────────

  /** Create a new game. Returns the transaction hash. */
  async createGame(maxPlayers: number, deckSize: number): Promise<bigint> {
    return this.contract.createGame(maxPlayers, deckSize);
  }

  /**
   * Join a game with a key ownership proof.
   * Generates the proof, converts to calldata, and submits to the contract.
   */
  async joinGame(gameId: bigint, secretKey: bigint): Promise<string> {
    const publicKey = privToPubKey(secretKey);

    // Generate proof
    const proof = await this.prover.proveKeyOwnership(secretKey, publicKey);
    const vk = this.getVk('key_ownership');
    const calldata = await proofToCalldata(proof, vk);

    return this.contract.joinGame(gameId, publicKey, calldata);
  }

  /**
   * Start a game: compute aggregate key, encrypt initial deck, submit.
   * Should be called by the game creator after all players have joined.
   */
  async startGame(gameId: bigint, deckSize: number): Promise<string> {
    // Read all player public keys from the contract
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const publicKeys: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      publicKeys.push(await this.contract.getPlayerPk(gameId, i));
    }

    // Compute aggregate public key
    const apk = computeAggregateKey(publicKeys);

    // Encrypt initial deck
    const { deck, randomness } = encryptDeck(deckSize, apk);

    return this.contract.startGame(gameId, apk, deck, randomness);
  }

  /**
   * Shuffle and re-encrypt the deck, generate proof, submit to contract.
   */
  async shuffle(gameId: bigint, secretKey: bigint): Promise<string> {
    const deckSize = await this.contract.getGameDeckSize(gameId);

    // Read current deck from contract
    const deckIn: EncryptedCard[] = [];
    for (let i = 0; i < deckSize; i++) {
      deckIn.push(await this.contract.getDeckCard(gameId, i));
    }

    // Compute aggregate public key
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const publicKeys: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      publicKeys.push(await this.contract.getPlayerPk(gameId, i));
    }
    const apk = computeAggregateKey(publicKeys);

    // Generate random permutation and shuffle
    const permutation = randomPermutation(deckSize);
    const { newDeck, randomness } = shuffleAndRemask(deckIn, permutation, apk);

    // Generate proof
    const circuitName = getShuffleCircuitName(deckSize);
    const proof = await this.prover.proveShuffle(
      deckIn,
      newDeck,
      apk,
      permutation,
      randomness,
      deckSize,
    );
    const vk = this.getVk(circuitName);
    const calldata = await proofToCalldata(proof, vk);

    return this.contract.submitShuffle(gameId, newDeck, calldata);
  }

  // ── Card operations ────────────────────────────────────────

  /** Deal cards to a player (game creator only). */
  async dealCards(
    gameId: bigint,
    cardIndices: number[],
    toPlayer: number,
  ): Promise<string> {
    return this.contract.dealCards(gameId, cardIndices, toPlayer);
  }

  /** Deal community cards (game creator only). */
  async dealCommunityCards(
    gameId: bigint,
    cardIndices: number[],
  ): Promise<string> {
    return this.contract.dealCommunityCards(gameId, cardIndices);
  }

  /**
   * Submit a reveal token for a card.
   * Computes the token, generates a proof, and submits to the contract.
   */
  async submitRevealToken(
    gameId: bigint,
    cardIndex: number,
    secretKey: bigint,
  ): Promise<string> {
    const publicKey = privToPubKey(secretKey);

    // Read the card's C1 from the contract
    const card = await this.contract.getDeckCard(gameId, cardIndex);
    const c1 = card.c1;

    // Compute reveal token
    const token = computeRevealToken(secretKey, c1);

    // Generate proof
    const proof = await this.prover.proveDecrypt(secretKey, c1, token, publicKey);
    const vk = this.getVk('decrypt_card');
    const calldata = await proofToCalldata(proof, vk);

    return this.contract.submitRevealToken(gameId, cardIndex, token, calldata);
  }

  /**
   * Decrypt a card locally by reading all reveal tokens from the contract.
   * Returns the card value (0-indexed) or -1 if lookup fails.
   */
  async decryptCard(
    gameId: bigint,
    cardIndex: number,
    deckSize: number,
  ): Promise<number> {
    const numPlayers = await this.contract.getGamePlayers(gameId);

    // Read the card
    const card = await this.contract.getDeckCard(gameId, cardIndex);

    // Read all reveal tokens
    const tokens: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      tokens.push(await this.contract.getRevealToken(gameId, cardIndex, i));
    }

    // Decrypt
    const decryptedPoint = decryptWithTokens(card.c2, tokens);

    // Look up in card table
    if (!this.cardTable || this.cardTable.size !== deckSize) {
      this.cardTable = buildCardTable(deckSize);
    }
    return lookupCard(decryptedPoint, this.cardTable);
  }

  /**
   * Unmask a card on-chain (after computing the card value locally).
   */
  async unmaskCard(
    gameId: bigint,
    cardIndex: number,
    cardValue: number,
  ): Promise<string> {
    return this.contract.unmaskCard(gameId, cardIndex, cardValue);
  }

  /** End a game (game creator only). */
  async endGame(gameId: bigint): Promise<string> {
    return this.contract.endGame(gameId);
  }

  // ── View helpers ───────────────────────────────────────────

  /** Get the current game state. */
  async getGameState(gameId: bigint): Promise<number> {
    return this.contract.getGameState(gameId);
  }

  /** Get the number of players in a game. */
  async getGamePlayers(gameId: bigint): Promise<number> {
    return this.contract.getGamePlayers(gameId);
  }

  /** Get a card from the deck. */
  async getDeckCard(gameId: bigint, cardIndex: number): Promise<EncryptedCard> {
    return this.contract.getDeckCard(gameId, cardIndex);
  }

  /** Clean up resources. */
  async destroy(): Promise<void> {
    await this.prover.destroy();
  }

  // ── Internal ───────────────────────────────────────────────

  private getVk(circuitName: string): Uint8Array {
    const vk = this.vks.get(circuitName);
    if (!vk) {
      throw new Error(`VK for '${circuitName}' not loaded. Call loadVk() first.`);
    }
    return vk;
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

// Re-export crypto utilities for direct use
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
