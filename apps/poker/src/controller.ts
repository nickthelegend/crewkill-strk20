import { ControllerConnector } from '@cartridge/connector';
import { constants } from 'starknet';

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';

export const controller = new ControllerConnector({
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
  policies: {
    contracts: {
      [contractAddress]: {
        methods: [
          { name: 'Create Table', entrypoint: 'create_table' },
          { name: 'Join Game', entrypoint: 'join_game' },
          { name: 'Start Game', entrypoint: 'start_game' },
          { name: 'Submit Shuffle', entrypoint: 'submit_shuffle' },
          { name: 'Start Hand', entrypoint: 'start_hand' },
          { name: 'Submit Reveal Token', entrypoint: 'submit_reveal_token' },
          { name: 'Unmask Card', entrypoint: 'unmask_card' },
          { name: 'Advance Phase', entrypoint: 'advance_phase' },
          { name: 'Check', entrypoint: 'bet_check' },
          { name: 'Call', entrypoint: 'bet_call' },
          { name: 'Raise', entrypoint: 'bet_raise' },
          { name: 'Fold', entrypoint: 'bet_fold' },
          { name: 'All In', entrypoint: 'bet_all_in' },
          { name: 'Showdown', entrypoint: 'showdown' },
          { name: 'Verify Hole Cards', entrypoint: 'verify_hole_cards' },
          { name: 'Verify Single Hole Card', entrypoint: 'verify_single_hole_card' },
          { name: 'Prepare New Hand', entrypoint: 'prepare_new_hand' },
          { name: 'Leave Game', entrypoint: 'leave_game' },
          { name: 'Timeout Shuffle', entrypoint: 'timeout_shuffle' },
          { name: 'Timeout Reveal', entrypoint: 'timeout_reveal' },
          { name: 'End Game', entrypoint: 'end_game' },
        ],
      },
    },
  },
});
