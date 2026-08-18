import type { Point, EncryptedCard, GameState } from '../types.js';

// Use dynamic import for starknet to avoid hard dependency at compile time
type Account = import('starknet').Account;
type Provider = import('starknet').Provider;
type Contract = import('starknet').Contract;

/** ABI for the MentalPoker contract (subset of the full ABI). */
const MENTAL_POKER_ABI = [
  {
    type: 'function',
    name: 'create_game',
    inputs: [
      { name: 'max_players', type: 'core::integer::u8' },
      { name: 'deck_size', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'join_game',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'pk_x', type: 'core::integer::u256' },
      { name: 'pk_y', type: 'core::integer::u256' },
      { name: 'proof', type: 'core::array::Span::<core::felt252>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'start_game',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'apk_x', type: 'core::integer::u256' },
      { name: 'apk_y', type: 'core::integer::u256' },
      { name: 'initial_deck_c1_x', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'initial_deck_c1_y', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'initial_deck_c2_x', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'initial_deck_c2_y', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'initial_deck_randomness', type: 'core::array::Span::<core::integer::u256>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'submit_shuffle',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'new_deck_c1_x', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'new_deck_c1_y', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'new_deck_c2_x', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'new_deck_c2_y', type: 'core::array::Span::<core::integer::u256>' },
      { name: 'proof', type: 'core::array::Span::<core::felt252>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'deal_cards',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_indices', type: 'core::array::Span::<core::integer::u8>' },
      { name: 'to_player', type: 'core::integer::u8' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'deal_community_cards',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_indices', type: 'core::array::Span::<core::integer::u8>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'submit_reveal_token',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
      { name: 'token_x', type: 'core::integer::u256' },
      { name: 'token_y', type: 'core::integer::u256' },
      { name: 'proof', type: 'core::array::Span::<core::felt252>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'unmask_card',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
      { name: 'card_value', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'end_game',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'register_shuffle_verifier',
    inputs: [
      { name: 'deck_size', type: 'core::integer::u8' },
      { name: 'verifier_address', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'get_game_state',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_game_players',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_game_max_players',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_game_deck_size',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_address',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::starknet::contract_address::ContractAddress' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_pk',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [
      { type: 'core::integer::u256' },
      { type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_deck_card',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
    ],
    outputs: [
      { type: 'core::integer::u256' },
      { type: 'core::integer::u256' },
      { type: 'core::integer::u256' },
      { type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_reveal_token',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [
      { type: 'core::integer::u256' },
      { type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_card_owner',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_unmasked_card',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_shuffle_count',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_current_shuffle_player',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_next_game_id',
    inputs: [],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_community_card',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'has_revealed',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
] as const;

/**
 * Typed wrapper around the MentalPoker Starknet contract.
 */
export class MentalPokerContract {
  private contract: Contract | null = null;
  private contractAddress: string;
  private account: Account;

  constructor(address: string, account: Account) {
    this.contractAddress = address;
    this.account = account;
  }

  private async getContract(): Promise<Contract> {
    if (!this.contract) {
      const { Contract } = await import('starknet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.contract = new Contract({
        abi: MENTAL_POKER_ABI as any,
        address: this.contractAddress,
        providerOrAccount: this.account,
      });
      // Wrap invoke to pass tip: 0 (devnet has too few txs for tip estimation)
      const origInvoke = this.contract.invoke.bind(this.contract);
      this.contract.invoke = ((method: string, args?: any, opts?: any) =>
        origInvoke(method, args, { tip: 0, ...opts })) as any;
    }
    return this.contract;
  }

  // ── Write functions ────────────────────────────────────────

  /**
   * Create a new game on-chain.
   * @param maxPlayers - Maximum number of players (2-6)
   * @param deckSize - Number of cards in the deck (40, 52, or 108)
   * @returns Transaction hash
   */
  async createGame(maxPlayers: number, deckSize: number): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.invoke('create_game', [maxPlayers, deckSize]);
    // The game_id is returned as the transaction result
    // In practice, you'd parse this from the transaction receipt events
    return BigInt(result.transaction_hash);
  }

  /**
   * Join a game by submitting a public key and key ownership proof.
   * @param gameId - The game to join
   * @param pk - Player's public key (Grumpkin point)
   * @param proofCalldata - Garaga-formatted proof calldata
   * @returns Transaction hash
   */
  async joinGame(
    gameId: bigint,
    pk: Point,
    proofCalldata: string[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('join_game', [
      gameId,
      toFelt(pk.x),
      toFelt(pk.y),
      proofCalldata,
    ]);
    return result.transaction_hash;
  }

  /**
   * Start a game by submitting the aggregate public key and initial encrypted deck.
   * @param gameId - The game to start
   * @param apk - Aggregate public key (sum of all player public keys)
   * @param deck - Initial encrypted deck
   * @returns Transaction hash
   */
  async startGame(
    gameId: bigint,
    apk: Point,
    deck: EncryptedCard[],
    randomness: bigint[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('start_game', [
      gameId,
      toFelt(apk.x),
      toFelt(apk.y),
      deck.map((c) => toFelt(c.c1.x)),
      deck.map((c) => toFelt(c.c1.y)),
      deck.map((c) => toFelt(c.c2.x)),
      deck.map((c) => toFelt(c.c2.y)),
      randomness.map((r) => toFelt(r)),
    ]);
    return result.transaction_hash;
  }

  /**
   * Submit a shuffled and re-encrypted deck with its ZK proof.
   * @param gameId - The game
   * @param newDeck - Shuffled + re-encrypted deck
   * @param proofCalldata - Garaga-formatted shuffle proof calldata
   * @returns Transaction hash
   */
  async submitShuffle(
    gameId: bigint,
    newDeck: EncryptedCard[],
    proofCalldata: string[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('submit_shuffle', [
      gameId,
      newDeck.map((c) => toFelt(c.c1.x)),
      newDeck.map((c) => toFelt(c.c1.y)),
      newDeck.map((c) => toFelt(c.c2.x)),
      newDeck.map((c) => toFelt(c.c2.y)),
      proofCalldata,
    ]);
    return result.transaction_hash;
  }

  /**
   * Deal specific cards to a player (game creator only).
   * @param gameId - The game
   * @param cardIndices - Card positions in the deck to deal
   * @param toPlayer - Player index (0-based) to receive the cards
   * @returns Transaction hash
   */
  async dealCards(
    gameId: bigint,
    cardIndices: number[],
    toPlayer: number,
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('deal_cards', [
      gameId,
      cardIndices,
      toPlayer,
    ]);
    return result.transaction_hash;
  }

  /**
   * Deal community cards visible to all players (game creator only).
   * All N players must submit reveal tokens for community cards.
   * @param gameId - The game
   * @param cardIndices - Card positions to mark as community cards
   * @returns Transaction hash
   */
  async dealCommunityCards(
    gameId: bigint,
    cardIndices: number[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('deal_community_cards', [
      gameId,
      cardIndices,
    ]);
    return result.transaction_hash;
  }

  /**
   * Submit a reveal token for a card with its decrypt proof.
   * The reveal token is `sk * C1` where C1 is the card's first ciphertext component.
   * @param gameId - The game
   * @param cardIndex - Card position in the deck
   * @param token - Reveal token (sk * C1)
   * @param proofCalldata - Garaga-formatted decrypt proof calldata
   * @returns Transaction hash
   */
  async submitRevealToken(
    gameId: bigint,
    cardIndex: number,
    token: Point,
    proofCalldata: string[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('submit_reveal_token', [
      gameId,
      cardIndex,
      toFelt(token.x),
      toFelt(token.y),
      proofCalldata,
    ]);
    return result.transaction_hash;
  }

  /**
   * Unmask a card on-chain after locally computing its value.
   * @param gameId - The game
   * @param cardIndex - Card position in the deck
   * @param cardValue - Decrypted card value (0-indexed)
   * @returns Transaction hash
   */
  async unmaskCard(
    gameId: bigint,
    cardIndex: number,
    cardValue: number,
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('unmask_card', [
      gameId,
      cardIndex,
      cardValue,
    ]);
    return result.transaction_hash;
  }

  /** End a game (game creator only). */
  async endGame(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('end_game', [gameId]);
    return result.transaction_hash;
  }

  /**
   * Register a shuffle verifier contract for a specific deck size (owner only).
   * @param deckSize - Deck size this verifier handles (40, 52, or 108)
   * @param verifierAddress - Address of the deployed Garaga verifier contract
   * @returns Transaction hash
   */
  async registerShuffleVerifier(
    deckSize: number,
    verifierAddress: string,
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('register_shuffle_verifier', [
      deckSize,
      verifierAddress,
    ]);
    return result.transaction_hash;
  }

  // ── View functions ─────────────────────────────────────────

  /** Get the current game state (0=Created, 1=Registration, 2=Shuffle, 3=Deal, 4=Complete). */
  async getGameState(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_state', [gameId]);
    // Handle both u8 return (simplified ABI) and enum object (full ABI)
    if (result && typeof result === 'object' && typeof (result as any).activeVariant === 'function') {
      const variant = (result as any).activeVariant();
      const map: Record<string, number> = { Created: 0, Registration: 1, Shuffle: 2, Deal: 3, Complete: 4 };
      return map[variant] ?? -1;
    }
    return Number(result);
  }

  /** Get the number of players currently in the game. */
  async getGamePlayers(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_players', [gameId]);
    return Number(result);
  }

  /** Get the maximum number of players allowed in the game. */
  async getGameMaxPlayers(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_max_players', [gameId]);
    return Number(result);
  }

  /** Get the deck size for the game. */
  async getGameDeckSize(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_deck_size', [gameId]);
    return Number(result);
  }

  /** Get a player's public key (Grumpkin point). */
  async getPlayerPk(gameId: bigint, playerIndex: number): Promise<Point> {
    const contract = await this.getContract();
    const result = await contract.call('get_player_pk', [gameId, playerIndex]) as bigint[];
    return { x: result[0], y: result[1] };
  }

  /** Get an encrypted card from the deck (C1, C2 points). */
  async getDeckCard(gameId: bigint, cardIndex: number): Promise<EncryptedCard> {
    const contract = await this.getContract();
    const result = await contract.call('get_deck_card', [gameId, cardIndex]) as bigint[];
    return {
      c1: { x: result[0], y: result[1] },
      c2: { x: result[2], y: result[3] },
    };
  }

  /** Get the reveal token submitted by a player for a specific card. */
  async getRevealToken(
    gameId: bigint,
    cardIndex: number,
    playerIndex: number,
  ): Promise<Point> {
    const contract = await this.getContract();
    const result = await contract.call('get_reveal_token', [
      gameId,
      cardIndex,
      playerIndex,
    ]) as bigint[];
    return { x: result[0], y: result[1] };
  }

  /** Get the player index that owns a dealt card (255 = undealt). */
  async getCardOwner(gameId: bigint, cardIndex: number): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_card_owner', [gameId, cardIndex]);
    return Number(result);
  }

  /** Get the unmasked (decrypted) card value (0 = not yet unmasked). */
  async getUnmaskedCard(gameId: bigint, cardIndex: number): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_unmasked_card', [gameId, cardIndex]);
    return Number(result);
  }

  /** Get how many players have completed their shuffle. */
  async getShuffleCount(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_shuffle_count', [gameId]);
    return Number(result);
  }

  /** Get the index of the player whose turn it is to shuffle. */
  async getCurrentShufflePlayer(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_current_shuffle_player', [gameId]);
    return Number(result);
  }

  /** Get the next game ID that will be assigned. */
  async getNextGameId(): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_next_game_id', []);
    return BigInt(result as string);
  }

  /** Check if a card is a community card (visible to all players). */
  async isCommunityCard(gameId: bigint, cardIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_community_card', [gameId, cardIndex]);
    return Boolean(result);
  }

  /** Check if a player has submitted their reveal token for a specific card. */
  async hasRevealed(
    gameId: bigint,
    cardIndex: number,
    playerIndex: number,
  ): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('has_revealed', [
      gameId,
      cardIndex,
      playerIndex,
    ]);
    return Boolean(result);
  }
}

function toFelt(n: bigint): string {
  return '0x' + n.toString(16);
}
