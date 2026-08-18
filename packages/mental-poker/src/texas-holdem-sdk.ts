import type { Point, EncryptedCard, KeyPair, SDKConfig, TableConfig } from './types.js';
import {
  generateKeyPair,
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
import { TexasHoldemContract } from './contract/texas-holdem.js';

type Account = import('starknet').Account;

const POKER_DECK_SIZE = 52;

/**
 * High-level SDK for Texas Hold'em on the Mental Poker protocol.
 * Orchestrates crypto, proofs, and contract interaction for poker.
 */
export class TexasHoldemSDK {
  private prover: MentalPokerProver;
  private contract: TexasHoldemContract;
  private cardTable: Map<string, number> | null = null;
  private vks: Map<string, Uint8Array> = new Map();

  private constructor(contract: TexasHoldemContract, prover: MentalPokerProver) {
    this.contract = contract;
    this.prover = prover;
  }

  static async create(
    account: Account,
    contractAddress: string,
    config?: SDKConfig,
  ): Promise<TexasHoldemSDK> {
    const contract = new TexasHoldemContract(contractAddress, account, config?.rpcUrl);
    const prover = new MentalPokerProver(config?.threads, config?.wasmPath);
    return new TexasHoldemSDK(contract, prover);
  }

  /** Load a compiled Noir circuit artifact. */
  async loadCircuit(name: string, artifact: any): Promise<void> {
    await this.prover.loadCircuit(name, artifact);
  }

  /** Load a verification key for a circuit. */
  loadVk(circuitName: string, vk: Uint8Array): void {
    this.vks.set(circuitName, vk);
  }

  /** Generate a new ElGamal keypair. */
  generateKeyPair(): KeyPair {
    return generateKeyPair();
  }

  /** Get the underlying contract wrapper for direct access. */
  getContract(): TexasHoldemContract {
    return this.contract;
  }

  // ── Table setup ──

  async createTable(config: TableConfig): Promise<bigint> {
    const txHash = await this.contract.createTable(
      config.maxPlayers,
      config.deckSize ?? POKER_DECK_SIZE,
      config.smallBlind,
      config.bigBlind,
      config.initialStack,
    );
    // Game ID is parsed from events in practice; return tx hash as bigint
    return BigInt(txHash);
  }

  async joinTable(gameId: bigint, secretKey: bigint): Promise<string> {
    const { publicKey } = { publicKey: generateKeyPair().publicKey };
    // Recompute from secretKey
    const { privToPubKey } = await import('./crypto/elgamal.js');
    const pk = privToPubKey(secretKey);

    const proof = await this.prover.proveKeyOwnership(secretKey, pk);
    const vk = this.vks.get('key_ownership');
    if (!vk) throw new Error('key_ownership VK not loaded');
    const calldata = await proofToCalldata(proof, vk);
    return this.contract.joinGame(gameId, pk, calldata);
  }

  async leaveTable(gameId: bigint): Promise<string> {
    return this.contract.leaveGame(gameId);
  }

  async startTable(gameId: bigint): Promise<string> {
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const pks: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      pks.push(await this.contract.getPlayerPk(gameId, i));
    }
    const apk = computeAggregateKey(pks);
    const { deck, randomness } = encryptDeck(POKER_DECK_SIZE, apk);
    return this.contract.startGame(gameId, apk, deck, randomness);
  }

  async shuffle(gameId: bigint, secretKey: bigint): Promise<string> {
    const deckSize = await this.contract.getGameDeckSize(gameId);
    const deckIn: EncryptedCard[] = [];
    for (let i = 0; i < deckSize; i++) {
      deckIn.push(await this.contract.getDeckCard(gameId, i));
    }

    // Collect PKs from active players only (multi-hand aware)
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const pks: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      try {
        const active = await this.contract.isPlayerActiveInHand(gameId, i);
        if (!active) continue;
      } catch { /* backward compat: treat all as active */ }
      pks.push(await this.contract.getPlayerPk(gameId, i));
    }
    const apk = computeAggregateKey(pks);

    const perm = randomPermutation(deckSize);
    const { newDeck, randomness } = shuffleAndRemask(deckIn, perm, apk);

    const proof = await this.prover.proveShuffle(
      deckIn, newDeck, apk, perm, randomness, deckSize,
    );
    const vk = this.vks.get('shuffle_encrypt');
    if (!vk) throw new Error('shuffle_encrypt VK not loaded');
    const calldata = await proofToCalldata(proof, vk);

    return this.contract.submitShuffle(gameId, newDeck, calldata);
  }

  // ── Hand flow ──

  async startHand(gameId: bigint): Promise<string> {
    return this.contract.startHand(gameId);
  }

  async newHand(gameId: bigint): Promise<string> {
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const pks: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const eliminated = await this.contract.isPlayerEliminated(gameId, i);
      if (!eliminated) {
        const stack = await this.contract.getPlayerStack(gameId, i);
        if (stack > 0n) {
          pks.push(await this.contract.getPlayerPk(gameId, i));
        }
      }
    }
    const apk = computeAggregateKey(pks);
    const { deck, randomness } = encryptDeck(POKER_DECK_SIZE, apk);
    return this.contract.prepareNewHand(gameId, apk, deck, randomness);
  }

  async submitRevealToken(
    gameId: bigint,
    cardIndex: number,
    secretKey: bigint,
  ): Promise<string> {
    const { privToPubKey } = await import('./crypto/elgamal.js');
    const pk = privToPubKey(secretKey);
    const card = await this.contract.getDeckCard(gameId, cardIndex);
    const token = computeRevealToken(secretKey, card.c1);

    const proof = await this.prover.proveDecrypt(secretKey, card.c1, token, pk);
    const vk = this.vks.get('decrypt_card');
    if (!vk) throw new Error('decrypt_card VK not loaded');
    const calldata = await proofToCalldata(proof, vk);

    return this.contract.submitRevealToken(gameId, cardIndex, token, calldata);
  }

  async decryptCard(gameId: bigint, cardIndex: number): Promise<number> {
    const numPlayers = await this.contract.getGamePlayers(gameId);
    const card = await this.contract.getDeckCard(gameId, cardIndex);

    const tokens: Point[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const revealed = await this.contract.hasRevealed(gameId, cardIndex, i);
      if (revealed) {
        tokens.push(await this.contract.getRevealToken(gameId, cardIndex, i));
      }
    }

    const plaintext = decryptWithTokens(card.c2, tokens);

    if (!this.cardTable) {
      this.cardTable = buildCardTable(POKER_DECK_SIZE);
    }
    return lookupCard(plaintext, this.cardTable);
  }

  async unmaskCard(gameId: bigint, cardIndex: number, cardValue: number): Promise<string> {
    // card_value is 1-indexed on chain (0 = not unmasked)
    return this.contract.unmaskCard(gameId, cardIndex, cardValue + 1);
  }

  // ── Betting ──

  async fold(gameId: bigint): Promise<string> {
    return this.contract.fold(gameId);
  }

  async check(gameId: bigint): Promise<string> {
    return this.contract.check(gameId);
  }

  async call(gameId: bigint): Promise<string> {
    return this.contract.call(gameId);
  }

  async raise(gameId: bigint, amount: bigint): Promise<string> {
    return this.contract.raise(gameId, amount);
  }

  async allIn(gameId: bigint): Promise<string> {
    return this.contract.allIn(gameId);
  }

  // ── Phase management ──

  async advancePhase(gameId: bigint): Promise<string> {
    const ready = await this.contract.isBettingRoundComplete(gameId);
    if (!ready) {
      throw new Error('Betting round not complete');
    }
    return this.contract.advancePhase(gameId);
  }

  async verifyHoleCards(gameId: bigint, playerIndex: number): Promise<string> {
    return this.contract.verifyHoleCards(gameId, playerIndex);
  }

  async showdown(gameId: bigint): Promise<string> {
    const ready = await this.contract.isBettingRoundComplete(gameId);
    if (!ready) {
      throw new Error('Betting round not complete');
    }
    return this.contract.showdown(gameId);
  }

  async endGame(gameId: bigint): Promise<string> {
    return this.contract.endGame(gameId);
  }

  // ── View helpers ──

  async getPokerPhase(gameId: bigint): Promise<number> {
    return this.contract.getPokerPhase(gameId);
  }

  async getPot(gameId: bigint): Promise<bigint> {
    return this.contract.getPot(gameId);
  }

  async getPlayerStack(gameId: bigint, playerIndex: number): Promise<bigint> {
    return this.contract.getPlayerStack(gameId, playerIndex);
  }

  async getCurrentBet(gameId: bigint): Promise<bigint> {
    return this.contract.getCurrentBet(gameId);
  }

  async getActionPlayer(gameId: bigint): Promise<number> {
    return this.contract.getActionPlayer(gameId);
  }

  async destroy(): Promise<void> {
    await this.prover.destroy();
  }
}
