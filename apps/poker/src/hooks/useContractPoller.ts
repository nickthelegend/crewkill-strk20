import { useState, useEffect, useRef, useCallback } from 'react';
import type { TexasHoldemSDK } from '@mental-poker/sdk';
import type { PolledState } from '../types';
import { POLL_INTERVAL, getHoleCardIndices, getCommunityCardIndices } from '../constants';

const EMPTY_STATE: PolledState = {
  gameState: 0,
  numPlayers: 0,
  maxPlayers: 2,
  gameId: null,
  shuffleCount: 0,
  currentShufflePlayer: 0,
  pokerPhase: 0,
  actionPlayer: 0,
  pot: 0n,
  currentBet: 0n,
  stacks: [],
  bets: [],
  folded: [],
  allIn: [],
  reveals: new Map(),
  unmaskedCards: new Map(),
  verifiedHoleCards: new Set(),
  myHoleCardIndices: [],
  otherPlayersHoleCardIndices: new Map(),
  handNumber: 0,
  eliminated: [],
  activeInHand: [],
  numActive: 0,
};

export function useContractPoller(
  sdk: TexasHoldemSDK | null,
  gameId: bigint | null,
  myPlayerIndex: number,
) {
  const [state, setState] = useState<PolledState>(EMPTY_STATE);
  const [enabled, setEnabled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef(false);

  // Use refs so the interval callback always reads current values (no stale closures)
  const sdkRef = useRef(sdk);
  const gameIdRef = useRef(gameId);
  const myPlayerIndexRef = useRef(myPlayerIndex);
  sdkRef.current = sdk;
  gameIdRef.current = gameId;
  myPlayerIndexRef.current = myPlayerIndex;

  const poll = useCallback(async () => {
    const currentSdk = sdkRef.current;
    const currentGameId = gameIdRef.current;
    const currentPlayerIndex = myPlayerIndexRef.current;

    if (!currentSdk || currentGameId === null || pollingRef.current) return;
    pollingRef.current = true;

    try {
      const contract = currentSdk.getContract();
      const gameState = await contract.getGameState(currentGameId);
      const numPlayers = await contract.getGamePlayers(currentGameId);
      const maxPlayers = await contract.getGameMaxPlayers(currentGameId);

      let shuffleCount = 0;
      let currentShufflePlayer = 0;
      let pokerPhase = 0;
      let actionPlayer = 0;
      let pot = 0n;
      let currentBet = 0n;
      const stacks: bigint[] = new Array(numPlayers).fill(0n);
      const bets: bigint[] = new Array(numPlayers).fill(0n);
      const folded: boolean[] = new Array(numPlayers).fill(false);
      const allIn: boolean[] = new Array(numPlayers).fill(false);
      const reveals = new Map<number, boolean[]>();
      const unmaskedCards = new Map<number, number>();
      const verifiedHoleCards = new Set<number>();

      // Multi-hand state
      let handNumber = 0;
      const eliminated: boolean[] = new Array(numPlayers).fill(false);
      const activeInHand: boolean[] = new Array(numPlayers).fill(true);
      let numActive = numPlayers;
      let lastWinnerRank: number | undefined;
      let lastWinnerAmount: bigint | undefined;

      try {
        handNumber = await contract.getHandNumber(currentGameId);
        numActive = await contract.getActivePlayerCount(currentGameId);
        for (let i = 0; i < numPlayers; i++) {
          eliminated[i] = await contract.isPlayerEliminated(currentGameId, i);
          activeInHand[i] = await contract.isPlayerActiveInHand(currentGameId, i);
        }
        try {
          lastWinnerRank = await contract.getLastWinnerRank(currentGameId);
          lastWinnerAmount = await contract.getLastWinnerAmount(currentGameId);
        } catch { /* old contracts */ }
      } catch {
        // Backward compat: old contracts without multi-hand
      }

      // Compute compact active index for my player
      // Active players get consecutive indices: 0, 1, 2, ...
      let myActiveIdx = -1;
      let activeIdx = 0;
      const activeMap = new Map<number, number>(); // original -> active index
      for (let i = 0; i < numPlayers; i++) {
        if (activeInHand[i]) {
          if (i === currentPlayerIndex) myActiveIdx = activeIdx;
          activeMap.set(i, activeIdx);
          activeIdx++;
        }
      }
      // If first hand (all active), myActiveIdx == currentPlayerIndex
      if (myActiveIdx === -1) myActiveIdx = currentPlayerIndex;

      const myHoleCardIndices = getHoleCardIndices(myActiveIdx);
      const otherPlayersHoleCardIndices = new Map<number, number[]>();
      for (let i = 0; i < numPlayers; i++) {
        if (i === currentPlayerIndex) continue;
        const aIdx = activeMap.get(i);
        if (aIdx !== undefined) {
          otherPlayersHoleCardIndices.set(i, getHoleCardIndices(aIdx));
        }
      }

      // Shuffle phase data
      if (gameState >= 2) {
        shuffleCount = await contract.getShuffleCount(currentGameId);
        currentShufflePlayer = await contract.getCurrentShufflePlayer(currentGameId);
      }

      // Deal/poker phase data
      if (gameState >= 3) {
        pokerPhase = await contract.getPokerPhase(currentGameId);
        actionPlayer = await contract.getActionPlayer(currentGameId);
        pot = await contract.getPot(currentGameId);
        currentBet = await contract.getCurrentBet(currentGameId);

        for (let i = 0; i < numPlayers; i++) {
          stacks[i] = await contract.getPlayerStack(currentGameId, i);
          bets[i] = await contract.getPlayerBet(currentGameId, i);
          folded[i] = await contract.hasPlayerFolded(currentGameId, i);
          allIn[i] = await contract.isPlayerAllIn(currentGameId, i);
        }

        // Check reveals for relevant cards based on phase
        // Use numActive for card index layout (compact active indices)
        const cardIndicesToCheck: number[] = [];
        for (let a = 0; a < numActive; a++) {
          cardIndicesToCheck.push(a * 2, a * 2 + 1);
        }

        const communityIndices = getCommunityCardIndices(numActive);
        if (pokerPhase >= 2) {
          cardIndicesToCheck.push(...communityIndices.flop);
        }
        if (pokerPhase >= 3) {
          cardIndicesToCheck.push(...communityIndices.turn);
        }
        if (pokerPhase >= 4) {
          cardIndicesToCheck.push(...communityIndices.river);
        }

        // Check reveals and unmasked values
        // Only check reveals from active players
        for (const cardIdx of cardIndicesToCheck) {
          const playerReveals: boolean[] = [];
          let allRevealed = true;
          for (let p = 0; p < numPlayers; p++) {
            if (!activeInHand[p]) {
              playerReveals.push(false);
              continue;
            }
            const revealed = await contract.hasRevealed(currentGameId, cardIdx, p);
            playerReveals.push(revealed);
            if (!revealed) allRevealed = false;
          }
          reveals.set(cardIdx, playerReveals);

          // If all active players revealed, check if unmasked
          if (allRevealed) {
            try {
              const val = await contract.getUnmaskedCard(currentGameId, cardIdx);
              if (val > 0 && val <= 52) {
                unmaskedCards.set(cardIdx, val - 1); // Convert to 0-indexed
              }
            } catch {
              // Not unmasked yet
            }
          }
        }

        // Poll hole card verification status (needed for showdown flow)
        if (pokerPhase >= 4) {
          for (const [origIdx, aIdx] of activeMap) {
            if (folded[origIdx]) continue;
            const holeIndices = [aIdx * 2, aIdx * 2 + 1];
            for (const idx of holeIndices) {
              try {
                const verified = await contract.isHoleCardVerified(currentGameId, idx);
                if (verified) verifiedHoleCards.add(idx);
              } catch (e) {
                console.error(`[Poller] isHoleCardVerified(card=${idx}) ERROR:`, e);
              }
            }
          }
        }
      }

      setState({
        gameState,
        numPlayers,
        maxPlayers,
        gameId: currentGameId,
        shuffleCount,
        currentShufflePlayer,
        pokerPhase,
        actionPlayer,
        pot,
        currentBet,
        stacks,
        bets,
        folded,
        allIn,
        reveals,
        unmaskedCards,
        verifiedHoleCards,
        myHoleCardIndices,
        otherPlayersHoleCardIndices,
        handNumber,
        eliminated,
        activeInHand,
        numActive,
        lastWinnerRank,
        lastWinnerAmount,
      });
    } catch (err) {
      console.warn('[Poller] Error:', err);
    } finally {
      pollingRef.current = false;
    }
  }, []); // No deps — reads everything from refs

  // Start/restart interval when enabled or poll changes
  useEffect(() => {
    if (!enabled) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Immediate first poll, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, poll]);

  const startPolling = useCallback(() => {
    setEnabled(true);
  }, []);

  const stopPolling = useCallback(() => {
    setEnabled(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const forcePoll = useCallback(() => {
    poll();
  }, [poll]);

  return { state, polling: enabled, startPolling, stopPolling, forcePoll };
}
