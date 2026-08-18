import type { PolledState } from '../types';
import { getHoleCardIndices, getAllHoleCardIndices, getCommunityCardIndices } from '../constants';

export type PlayerAction =
  | { type: 'WAIT'; message: string }
  | { type: 'CREATE_TABLE' }
  | { type: 'JOIN_TABLE'; gameId: bigint }
  | { type: 'START_TABLE' }
  | { type: 'SHUFFLE' }
  | { type: 'START_HAND' }
  | { type: 'PREPARE_NEW_HAND' }
  | { type: 'SUBMIT_REVEALS'; cardIndices: number[] }
  | { type: 'DECRYPT_LOCAL'; cardIndices: number[] }
  | { type: 'DECRYPT_AND_UNMASK'; cardIndices: number[] }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'BET'; options: ('fold' | 'check' | 'call' | 'raise')[] }
  | { type: 'VERIFY_HOLE_CARDS'; playerIndex: number }
  | { type: 'SHOWDOWN' }
  | { type: 'GAME_OVER' };

/**
 * Pure function: given polled contract state, determine what the current player should do.
 * localDecryptedCards: set of card indices that have been decrypted locally (not on-chain).
 */
export function determineAction(
  polledState: PolledState,
  myPlayerIndex: number,
  localDecryptedCards: Set<number>,
  bettingRoundComplete = false,
  lastPreparedHand = -1,
): PlayerAction {
  const { gameState, numPlayers, maxPlayers, shuffleCount, currentShufflePlayer, numActive } = polledState;

  // GameState: 0=Created, 1=Registration, 2=Shuffle, 3=Deal, 4=Complete

  // --- Registration Phase ---
  if (gameState === 1) {
    if (numPlayers < maxPlayers) {
      return { type: 'WAIT', message: `Waiting for players... (${numPlayers}/${maxPlayers})` };
    }
    if (myPlayerIndex === 0) {
      return { type: 'START_TABLE' };
    }
    return { type: 'WAIT', message: 'Waiting for Player 1 to start...' };
  }

  // --- Shuffle Phase ---
  if (gameState === 2) {
    // Use numActive for multi-hand (fallback to numPlayers for first hand)
    const shuffleTarget = numActive > 0 ? numActive : numPlayers;
    if (shuffleCount < shuffleTarget) {
      if (currentShufflePlayer === myPlayerIndex) {
        return { type: 'SHUFFLE' };
      }
      return { type: 'WAIT', message: `Waiting for Player ${currentShufflePlayer + 1} to shuffle...` };
    }
    return { type: 'WAIT', message: 'Transitioning to deal phase...' };
  }

  // --- Deal Phase ---
  if (gameState === 3) {
    return determineDealAction(polledState, myPlayerIndex, localDecryptedCards, bettingRoundComplete, lastPreparedHand);
  }

  // --- Complete ---
  if (gameState === 4) {
    return { type: 'GAME_OVER' };
  }

  return { type: 'WAIT', message: 'Waiting...' };
}

function determineDealAction(
  state: PolledState,
  myPlayerIndex: number,
  localDecryptedCards: Set<number>,
  bettingRoundComplete: boolean,
  lastPreparedHand: number,
): PlayerAction {
  const { pokerPhase, numPlayers, numActive, unmaskedCards, handNumber, activeInHand } = state;

  // --- pokerPhase None: need to start hand or prepare new hand ---
  if (pokerPhase === 0) {
    // Only prepare if we haven't already prepared for this handNumber
    if (handNumber > 0 && handNumber > lastPreparedHand) {
      // Multi-hand: need to prepare new hand (new APK, fresh deck)
      // First active player (creator) does it
      if (myPlayerIndex === 0) {
        return { type: 'PREPARE_NEW_HAND' };
      }
      return { type: 'WAIT', message: 'Waiting for new hand preparation...' };
    }
    if (myPlayerIndex === 0) {
      return { type: 'START_HAND' };
    }
    return { type: 'WAIT', message: 'Waiting for Player 1 to deal...' };
  }

  // --- PreFlop: reveal hole cards, then bet ---
  if (pokerPhase === 1) {
    const holeAction = handleHoleCardReveals(state, myPlayerIndex, localDecryptedCards);
    if (holeAction) return holeAction;
    return determineBettingAction(state, myPlayerIndex);
  }

  // --- Flop (2) / Turn (3) ---
  if (pokerPhase >= 2 && pokerPhase <= 3) {
    const communityAction = handleCommunityCardReveals(state, myPlayerIndex);
    if (communityAction) return communityAction;
    return determineBettingAction(state, myPlayerIndex);
  }

  // --- River (4) ---
  if (pokerPhase === 4) {
    const communityAction = handleCommunityCardReveals(state, myPlayerIndex);
    if (communityAction) return communityAction;

    // Check if someone already started the showdown flow (hole cards being unmasked)
    const allHoleIndices = getAllHoleCardIndices(numActive);
    const anyHoleUnmasked = allHoleIndices.some(idx => unmaskedCards.has(idx));

    if (anyHoleUnmasked || bettingRoundComplete) {
      return handleShowdown(state, myPlayerIndex);
    }

    return determineBettingAction(state, myPlayerIndex);
  }

  // --- Showdown: unmask hole cards on-chain THEN evaluate ---
  if (pokerPhase === 5) {
    return handleShowdown(state, myPlayerIndex);
  }

  return { type: 'WAIT', message: 'Waiting...' };
}

/**
 * Handle hole card reveals during PreFlop.
 * Cards are decrypted LOCALLY only (not unmasked on-chain) to keep them private.
 */
function handleHoleCardReveals(
  state: PolledState,
  myPlayerIndex: number,
  localDecryptedCards: Set<number>,
): PlayerAction | null {
  const { reveals, numActive, activeInHand } = state;
  // Use numActive for card index layout (compact active indices)
  const allHoleIndices = getAllHoleCardIndices(numActive);

  // 1. Submit my reveals for all hole cards (mine and all other players')
  // Only if I'm active in this hand
  if (!activeInHand[myPlayerIndex]) return null;

  const needReveal = allHoleIndices.filter(idx => {
    const rev = reveals.get(idx);
    return !rev || !rev[myPlayerIndex];
  });
  if (needReveal.length > 0) {
    return { type: 'SUBMIT_REVEALS', cardIndices: needReveal };
  }

  // 2. Decrypt my own cards LOCALLY (NOT on-chain — keeps them private)
  const myHoleIndices = state.myHoleCardIndices;
  const needDecrypt = myHoleIndices.filter(idx => {
    const rev = reveals.get(idx);
    // Check all active players have revealed
    return rev && rev.every((r, i) => !activeInHand[i] || r) && !localDecryptedCards.has(idx);
  });
  if (needDecrypt.length > 0) {
    return { type: 'DECRYPT_LOCAL', cardIndices: [...needDecrypt] };
  }

  // 3. Ready for betting — don't wait for others (they decrypt locally too)
  return null;
}

/**
 * Handle community card reveals. These ARE unmasked on-chain (they're public).
 */
function handleCommunityCardReveals(
  state: PolledState,
  myPlayerIndex: number,
): PlayerAction | null {
  const { pokerPhase, numActive, reveals, unmaskedCards, activeInHand } = state;
  if (!activeInHand[myPlayerIndex]) return null;
  const communityIndices = getCommunityIndicesForPhase(pokerPhase, numActive);

  // 1. Submit my reveals
  const needReveal = communityIndices.filter(idx => {
    const rev = reveals.get(idx);
    return !rev || !rev[myPlayerIndex];
  });
  if (needReveal.length > 0) {
    return { type: 'SUBMIT_REVEALS', cardIndices: needReveal };
  }

  // 2. Decrypt/unmask (P1 does this for community cards — they're public)
  const needUnmask = communityIndices.filter(idx => {
    const rev = reveals.get(idx);
    return rev && rev.every(r => r) && !unmaskedCards.has(idx);
  });
  if (needUnmask.length > 0) {
    if (myPlayerIndex === 0) {
      return { type: 'DECRYPT_AND_UNMASK', cardIndices: [...needUnmask] };
    }
    return { type: 'WAIT', message: 'Waiting for community cards to be revealed...' };
  }

  return null;
}

/**
 * Handle showdown: unmask hole cards on-chain, verify them, then evaluate.
 * Verification is split from showdown to avoid Cairo VM step limits with 4+ players.
 */
function handleShowdown(
  state: PolledState,
  myPlayerIndex: number,
): PlayerAction {
  const { numPlayers, unmaskedCards, folded, verifiedHoleCards, activeInHand, otherPlayersHoleCardIndices } = state;

  // 1. Unmask my hole cards on-chain (needed for contract hand evaluation)
  const myHoleIndices = state.myHoleCardIndices;
  if (activeInHand[myPlayerIndex]) {
    const needUnmask = myHoleIndices.filter(idx => !unmaskedCards.has(idx));
    if (needUnmask.length > 0) {
      return { type: 'DECRYPT_AND_UNMASK', cardIndices: needUnmask };
    }
  }

  // 2. Wait for all other non-folded active players to unmask their hole cards
  for (let p = 0; p < numPlayers; p++) {
    if (p === myPlayerIndex) continue;
    if (folded[p] || !activeInHand[p]) continue;
    const pHoleIndices = otherPlayersHoleCardIndices.get(p);
    if (pHoleIndices && pHoleIndices.some(idx => !unmaskedCards.has(idx))) {
      return { type: 'WAIT', message: `Waiting for Player ${p + 1} to reveal cards...` };
    }
  }

  // 3. Verify my own hole cards (anyone can call this, each player verifies their own)
  if (activeInHand[myPlayerIndex] && !folded[myPlayerIndex]) {
    const myNeedVerify = myHoleIndices.some(idx => !verifiedHoleCards.has(idx));
    if (myNeedVerify) {
      return { type: 'VERIFY_HOLE_CARDS', playerIndex: myPlayerIndex };
    }
  }

  // 4. Wait for all non-folded active players' hole cards to be verified
  for (let p = 0; p < numPlayers; p++) {
    if (folded[p] || !activeInHand[p]) continue;
    const pHoleIndices = p === myPlayerIndex ? myHoleIndices : (otherPlayersHoleCardIndices.get(p) ?? []);
    if (pHoleIndices.some(idx => !verifiedHoleCards.has(idx))) {
      return { type: 'WAIT', message: `Waiting for Player ${p + 1} to verify cards...` };
    }
  }

  // 5. All verified — P1 calls showdown
  if (myPlayerIndex === 0) {
    return { type: 'SHOWDOWN' };
  }
  return { type: 'WAIT', message: 'Evaluating hands...' };
}

function determineBettingAction(
  state: PolledState,
  myPlayerIndex: number,
): PlayerAction {
  const { actionPlayer, currentBet, bets, folded, numPlayers } = state;

  // If only 1 player remains (others folded), the contract already ended the game
  // via check_single_winner — do NOT call showdown(). Wait for gameState=4 poll.
  const nonFoldedCount = folded.filter(f => !f).length;
  if (nonFoldedCount <= 1) {
    return { type: 'WAIT', message: 'Waiting for game result...' };
  }

  if (actionPlayer !== myPlayerIndex) {
    return { type: 'WAIT', message: `Waiting for Player ${actionPlayer + 1} to act...` };
  }

  // It's our turn
  const myBet = bets[myPlayerIndex];
  const options: ('fold' | 'check' | 'call' | 'raise')[] = ['fold'];

  if (myBet >= currentBet) {
    options.push('check');
    options.push('raise');
  } else {
    options.push('call');
    options.push('raise');
  }

  return { type: 'BET', options };
}

function getCommunityIndicesForPhase(phase: number, numActive: number): number[] {
  const comm = getCommunityCardIndices(numActive);
  switch (phase) {
    case 2: return [...comm.flop];
    case 3: return [...comm.turn];
    case 4: return [...comm.river];
    default: return [];
  }
}

/**
 * Check if an action should be auto-executed (no user input needed).
 */
export function isAutoAction(action: PlayerAction): boolean {
  switch (action.type) {
    case 'START_TABLE':
    case 'SHUFFLE':
    case 'START_HAND':
    case 'PREPARE_NEW_HAND':
    case 'SUBMIT_REVEALS':
    case 'DECRYPT_LOCAL':
    case 'DECRYPT_AND_UNMASK':
    case 'ADVANCE_PHASE':
    case 'VERIFY_HOLE_CARDS':
    case 'SHOWDOWN':
      return true;
    default:
      return false;
  }
}
