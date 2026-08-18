import type { Point, EncryptedCard, PokerPhase } from '../types.js';

type Account = import('starknet').Account;
type Contract = import('starknet').Contract;

/** ABI for the TexasHoldem contract (poker functions + embedded MentalPoker functions). */
const TEXAS_HOLDEM_ABI = [
  // ── Poker write functions ──
  {
    type: 'function',
    name: 'create_table',
    inputs: [
      { name: 'max_players', type: 'core::integer::u8' },
      { name: 'deck_size', type: 'core::integer::u8' },
      { name: 'small_blind', type: 'core::integer::u256' },
      { name: 'big_blind', type: 'core::integer::u256' },
      { name: 'initial_stack', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::integer::u64' }],
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
    name: 'start_hand',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'advance_phase',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'showdown',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'bet_fold',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'bet_check',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'bet_call',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'bet_raise',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'bet_all_in',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
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
    name: 'prepare_new_hand',
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
    name: 'register_shuffle_verifier',
    inputs: [
      { name: 'deck_size', type: 'core::integer::u8' },
      { name: 'verifier_address', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  // ── Embedded MentalPoker write functions ──
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
    name: 'timeout_shuffle',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'timeout_reveal',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [],
    state_mutability: 'external',
  },
  // ── Poker view functions ──
  {
    type: 'function',
    name: 'get_poker_phase',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_pot',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_stack',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_current_bet',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_action_player',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'has_player_folded',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_player_bet',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_dealer_index',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_next_card_index',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_small_blind',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_big_blind',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_initial_stack',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_player_all_in',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_betting_round_complete',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'verify_hole_cards',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'verify_single_hole_card',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
      { name: 'card_slot', type: 'core::integer::u8' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'is_hole_card_verified',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'card_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_player_eliminated',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  // ── Embedded MentalPoker view functions ──
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
    name: 'get_game_creator',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::starknet::contract_address::ContractAddress' }],
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
  {
    type: 'function',
    name: 'get_hand_number',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u32' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_player_active_in_hand',
    inputs: [
      { name: 'game_id', type: 'core::integer::u64' },
      { name: 'player_index', type: 'core::integer::u8' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_active_player_count',
    inputs: [{ name: 'game_id', type: 'core::integer::u64' }],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
] as const;

function toFelt(n: bigint): string {
  return '0x' + n.toString(16);
}

/**
 * Typed wrapper around the TexasHoldem Starknet contract.
 * Includes both poker-specific and embedded MentalPoker functions.
 */
export class TexasHoldemContract {
  private contract: Contract | null = null;
  private contractAddress: string;
  private account: Account;
  private rpcUrl: string | undefined;

  constructor(address: string, account: Account, rpcUrl?: string) {
    this.contractAddress = address;
    this.account = account;
    this.rpcUrl = rpcUrl;
  }

  private async getContract(): Promise<Contract> {
    if (!this.contract) {
      const { Contract } = await import('starknet');
      this.contract = new Contract({
        abi: TEXAS_HOLDEM_ABI as any,
        address: this.contractAddress,
        providerOrAccount: this.account,
      });
      // Wrap invoke to pass tip: 0 and wait for tx confirmation.
      // Without waitForTransaction, invoke returns immediately after submitting the tx.
      // On Sepolia, this means the frontend marks actions as "complete" before the tx
      // is confirmed, and if the tx reverts, the action is never retried.
      // We create a dedicated RpcProvider for waiting because AccountInterface
      // (e.g., Cartridge Controller) may not have waitForTransaction.
      const origInvoke = this.contract.invoke.bind(this.contract);
      const rpcUrl = this.rpcUrl || (this.account as any).channel?.nodeUrl;
      let waitProvider: any = null;
      console.log('[SDK] invoke wrapper init — rpcUrl:', rpcUrl || 'NONE');
      if (rpcUrl) {
        const { RpcProvider } = await import('starknet');
        waitProvider = new RpcProvider({ nodeUrl: rpcUrl });
        console.log('[SDK] waitProvider created OK');
      } else {
        console.warn('[SDK] NO rpcUrl — cannot wait for tx confirmation!');
      }
      // Heavy EC-math methods that need higher L2 gas limit (default 1B is insufficient)
      const HEAVY_METHODS = new Set(['showdown']);
      this.contract.invoke = (async (method: string, args?: any, opts?: any) => {
        console.log(`[SDK] invoke(${method}) — sending tx...`);
        const invokeOpts: any = { tip: 0, ...opts };
        const baseOpts: any = { tip: 0, ...opts };
        const shouldTryHeavyBounds = HEAVY_METHODS.has(method) && !opts?.resourceBounds;
        // Override L2 gas for heavy methods that exceed default 1B limit
        if (shouldTryHeavyBounds) {
          invokeOpts.resourceBounds = {
            // Use bigint values to avoid type-mixing issues in Starknet SDK math.
            l2_gas: { max_amount: 8_000_000_000n, max_price_per_unit: 25n }, // 8B L2Gas
            l1_gas: { max_amount: 10_000n, max_price_per_unit: 1_000_000_000n },
            // Required by Starknet.js v8 tx hash encoder for V3 transactions.
            l1_data_gas: { max_amount: 10_000n, max_price_per_unit: 1_000_000_000n },
          };
          console.log(`[SDK] invoke(${method}) — using high L2 gas limit (8B)`);
        }
        let result: any;
        try {
          result = await origInvoke(method, args, invokeOpts);
        } catch (invokeErr: any) {
          const msg = String(invokeErr?.message || invokeErr);
          const lowResourceErr = msg.includes("resources don't cover validation")
            || msg.includes('minimal transaction fee');
          if (shouldTryHeavyBounds && lowResourceErr) {
            console.warn(`[SDK] invoke(${method}) — high bounds rejected, retrying with default fee estimation...`);
            result = await origInvoke(method, args, baseOpts);
          } else {
            throw invokeErr;
          }
        }
        const txHash = result.transaction_hash;
        console.log(`[SDK] invoke(${method}) — tx hash: ${txHash}`);
        if (waitProvider) {
          console.log(`[SDK] invoke(${method}) — waiting for confirmation...`);
          try {
            const receipt = await waitProvider.waitForTransaction(txHash);
            const status = (receipt as any)?.execution_status || (receipt as any)?.statusReceipt || 'unknown';
            console.log(`[SDK] invoke(${method}) — confirmed! status:`, status);
            // waitForTransaction does NOT throw on REVERTED — check explicitly
            if (status === 'REVERTED' || status === 'REJECTED') {
              const revertReason = (receipt as any)?.revert_reason || 'Transaction reverted on-chain';
              console.error(`[SDK] invoke(${method}) — tx REVERTED:`, revertReason);
              throw new Error(`Transaction ${method} reverted: ${revertReason}`);
            }
          } catch (waitErr: any) {
            console.error(`[SDK] invoke(${method}) — tx failed:`, waitErr?.message || waitErr);
            throw waitErr;
          }
        } else {
          console.warn(`[SDK] invoke(${method}) — NO waitProvider, skipping confirmation wait`);
        }
        return result;
      }) as any;
    }
    return this.contract;
  }

  // ── Poker write functions ──

  async createTable(
    maxPlayers: number,
    deckSize: number,
    smallBlind: bigint,
    bigBlind: bigint,
    initialStack: bigint,
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('create_table', [
      maxPlayers,
      deckSize,
      toFelt(smallBlind),
      toFelt(bigBlind),
      toFelt(initialStack),
    ]);
    return result.transaction_hash;
  }

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

  async startHand(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('start_hand', [gameId]);
    return result.transaction_hash;
  }

  async advancePhase(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('advance_phase', [gameId]);
    return result.transaction_hash;
  }

  async showdown(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('showdown', [gameId]);
    return result.transaction_hash;
  }

  async verifyHoleCards(gameId: bigint, playerIndex: number): Promise<string> {
    const contract = await this.getContract();
    // Verify each hole card separately to stay under gas limits (Cartridge Controller caps at 1B L2Gas).
    // verify_single_hole_card uses ~550M gas vs verify_hole_cards ~1.1B for both.
    const result0 = await contract.invoke('verify_single_hole_card', [gameId, playerIndex, 0]);
    const result1 = await contract.invoke('verify_single_hole_card', [gameId, playerIndex, 1]);
    return result1.transaction_hash;
  }

  async fold(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('bet_fold', [gameId]);
    return result.transaction_hash;
  }

  async check(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('bet_check', [gameId]);
    return result.transaction_hash;
  }

  async call(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('bet_call', [gameId]);
    return result.transaction_hash;
  }

  async raise(gameId: bigint, amount: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('bet_raise', [gameId, toFelt(amount)]);
    return result.transaction_hash;
  }

  async allIn(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('bet_all_in', [gameId]);
    return result.transaction_hash;
  }

  async endGame(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('end_game', [gameId]);
    return result.transaction_hash;
  }

  async prepareNewHand(
    gameId: bigint,
    apk: Point,
    deck: EncryptedCard[],
    randomness: bigint[],
  ): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('prepare_new_hand', [
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

  // ── Embedded MentalPoker write functions ──

  async joinGame(gameId: bigint, pk: Point, proofCalldata: string[]): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('join_game', [
      gameId,
      toFelt(pk.x),
      toFelt(pk.y),
      proofCalldata,
    ]);
    return result.transaction_hash;
  }

  async leaveGame(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('leave_game', [gameId]);
    return result.transaction_hash;
  }

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

  async unmaskCard(gameId: bigint, cardIndex: number, cardValue: number): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.invoke('unmask_card', [gameId, cardIndex, cardValue]);
    return result.transaction_hash;
  }

  // ── Poker view functions ──

  async getPokerPhase(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_poker_phase', [gameId]);
    if (result && typeof result === 'object' && typeof (result as any).activeVariant === 'function') {
      const variant = (result as any).activeVariant();
      const map: Record<string, number> = { None: 0, PreFlop: 1, Flop: 2, Turn: 3, River: 4, Showdown: 5 };
      return map[variant] ?? -1;
    }
    return Number(result);
  }

  async getPot(gameId: bigint): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_pot', [gameId]);
    return BigInt(result as string);
  }

  async getPlayerStack(gameId: bigint, playerIndex: number): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_player_stack', [gameId, playerIndex]);
    return BigInt(result as string);
  }

  async getCurrentBet(gameId: bigint): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_current_bet', [gameId]);
    return BigInt(result as string);
  }

  async getActionPlayer(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_action_player', [gameId]);
    return Number(result);
  }

  async hasPlayerFolded(gameId: bigint, playerIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('has_player_folded', [gameId, playerIndex]);
    return Boolean(result);
  }

  async getPlayerBet(gameId: bigint, playerIndex: number): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_player_bet', [gameId, playerIndex]);
    return BigInt(result as string);
  }

  async getDealerIndex(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_dealer_index', [gameId]);
    return Number(result);
  }

  async getSmallBlind(): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_small_blind', []);
    return BigInt(result as string);
  }

  async getBigBlind(): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_big_blind', []);
    return BigInt(result as string);
  }

  async getInitialStack(): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_initial_stack', []);
    return BigInt(result as string);
  }

  // ── Embedded MentalPoker view functions ──

  async getGameState(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_state', [gameId]);
    if (result && typeof result === 'object' && typeof (result as any).activeVariant === 'function') {
      const variant = (result as any).activeVariant();
      const map: Record<string, number> = { Created: 0, Registration: 1, Shuffle: 2, Deal: 3, Complete: 4 };
      return map[variant] ?? -1;
    }
    return Number(result);
  }

  async getGamePlayers(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_players', [gameId]);
    return Number(result);
  }

  async getGameMaxPlayers(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_max_players', [gameId]);
    return Number(result);
  }

  async getGameDeckSize(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_deck_size', [gameId]);
    return Number(result);
  }

  async getPlayerPk(gameId: bigint, playerIndex: number): Promise<Point> {
    const contract = await this.getContract();
    const result = await contract.call('get_player_pk', [gameId, playerIndex]) as bigint[];
    return { x: result[0], y: result[1] };
  }

  async getDeckCard(gameId: bigint, cardIndex: number): Promise<EncryptedCard> {
    const contract = await this.getContract();
    const result = await contract.call('get_deck_card', [gameId, cardIndex]) as bigint[];
    return {
      c1: { x: result[0], y: result[1] },
      c2: { x: result[2], y: result[3] },
    };
  }

  async getRevealToken(gameId: bigint, cardIndex: number, playerIndex: number): Promise<Point> {
    const contract = await this.getContract();
    const result = await contract.call('get_reveal_token', [gameId, cardIndex, playerIndex]) as bigint[];
    return { x: result[0], y: result[1] };
  }

  async getUnmaskedCard(gameId: bigint, cardIndex: number): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_unmasked_card', [gameId, cardIndex]);
    return Number(result);
  }

  async getShuffleCount(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_shuffle_count', [gameId]);
    return Number(result);
  }

  async getCurrentShufflePlayer(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_current_shuffle_player', [gameId]);
    return Number(result);
  }

  async hasRevealed(gameId: bigint, cardIndex: number, playerIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('has_revealed', [gameId, cardIndex, playerIndex]);
    return Boolean(result);
  }

  async getHandNumber(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_hand_number', [gameId]);
    return Number(result);
  }

  async isPlayerEliminated(gameId: bigint, playerIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_player_eliminated', [gameId, playerIndex]);
    return Boolean(result);
  }

  async isPlayerActiveInHand(gameId: bigint, playerIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_player_active_in_hand', [gameId, playerIndex]);
    return Boolean(result);
  }

  async getActivePlayerCount(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_active_player_count', [gameId]);
    return Number(result);
  }

  async isPlayerAllIn(gameId: bigint, playerIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_player_all_in', [gameId, playerIndex]);
    return Boolean(result);
  }

  async isBettingRoundComplete(gameId: bigint): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_betting_round_complete', [gameId]);
    return Boolean(result);
  }

  async isHoleCardVerified(gameId: bigint, cardIndex: number): Promise<boolean> {
    const contract = await this.getContract();
    const result = await contract.call('is_hole_card_verified', [gameId, cardIndex]);
    return Boolean(result);
  }

  async getNextGameId(): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_next_game_id', []);
    return BigInt(result as string);
  }

  async getGameCreator(gameId: bigint): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.call('get_game_creator', [gameId]);
    return '0x' + (result as bigint).toString(16);
  }

  async getPlayerAddress(gameId: bigint, playerIndex: number): Promise<string> {
    const contract = await this.getContract();
    const result = await contract.call('get_player_address', [gameId, playerIndex]);
    return '0x' + (result as bigint).toString(16);
  }

  async getLastWinnerRank(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_last_winner_rank', [gameId]);
    return Number(result);
  }

  async getLastWinnerIndex(gameId: bigint): Promise<number> {
    const contract = await this.getContract();
    const result = await contract.call('get_last_winner_index', [gameId]);
    return Number(result);
  }

  async getLastWinnerAmount(gameId: bigint): Promise<bigint> {
    const contract = await this.getContract();
    const result = await contract.call('get_last_winner_amount', [gameId]);
    return BigInt(result as string);
  }
}
