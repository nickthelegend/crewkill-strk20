import { useState, useCallback, useRef } from 'react';

/** Extract the shortest meaningful message from a Starknet/contract error. */
function extractErrorMessage(err: any): string {
  const raw: string = err?.message || String(err);

  // Starknet: Failure reason: 0x... ('Not your turn')
  const failureReason = raw.match(/Failure reason: 0x[0-9a-fA-F]+ \('([^']+)'\)/i);
  if (failureReason) return failureReason[1];

  // Starknet: Error message: 'something'
  const errMsg = raw.match(/Error message: '([^']+)'/i);
  if (errMsg) return errMsg[1];

  // Generic revert: revert: "message" or execution reverted: message
  const revert = raw.match(/(?:execution )?revert(?:ed)?: "?([^"'\n]+)"?/i);
  if (revert) return revert[1].trim();

  // Fall back to first line, capped at 120 chars
  const firstLine = raw.split('\n')[0];
  return firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine;
}
import type { TexasHoldemSDK } from '@mental-poker/sdk';
import {
  decryptWithTokens,
  buildCardTable,
  lookupCard,
} from '@mental-poker/sdk';
import type { Point } from '@mental-poker/sdk';
import { DECK_SIZE } from '../constants';
import type { LogEntry } from '../types';

export function useGameActions(
  sdk: TexasHoldemSDK | null,
  secretKey: bigint,
  addLog: (phase: string, message: string, txHash?: string, duration?: number) => void,
) {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cardTableRef = useRef(buildCardTable(DECK_SIZE));
  // Synchronous guard — prevents double-submits before React re-renders disabled state
  const pendingRef = useRef(false);

  const exec = useCallback(async <T>(
    message: string,
    fn: () => Promise<T>,
    phase = 'ACTION',
  ): Promise<T | null> => {
    if (!sdk || pendingRef.current) return null;
    pendingRef.current = true;
    setLoading(true);
    setLoadingMessage(message);
    setError(null);
    const t = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - t;
      if (typeof result === 'string' && result.startsWith('0x')) {
        addLog(phase, message, result, elapsed);
      } else {
        addLog(phase, `${message} (${elapsed}ms)`, undefined, elapsed);
      }
      return result;
    } catch (err: any) {
      console.error(`[useGameActions] ${message} failed:`, err);
      const msg = extractErrorMessage(err);
      setError(msg);
      addLog('ERROR', `${message} failed: ${msg}`);
      return null;
    } finally {
      pendingRef.current = false;
      setLoading(false);
      setLoadingMessage('');
    }
  }, [sdk, addLog]);

  const createTable = useCallback(async (maxPlayers = 2): Promise<bigint | null> => {
    if (!sdk) return null;
    // Get next game ID first
    const contract = sdk.getContract();
    const gameId = await contract.getNextGameId();
    const txHash = await exec(
      'Creating table...',
      () => sdk.createTable({ maxPlayers, smallBlind: 5n, bigBlind: 10n, initialStack: 1000n }),
      'CREATE',
    );
    return txHash !== null ? gameId : null;
  }, [sdk, exec]);

  const joinTable = useCallback(async (gameId: bigint) => {
    return exec(
      'Joining table (generating key ownership proof)...',
      () => sdk!.joinTable(gameId, secretKey),
      'JOIN',
    );
  }, [sdk, secretKey, exec]);

  const leaveTable = useCallback(async (gameId: bigint) => {
    return exec('Leaving table...', () => sdk!.leaveTable(gameId), 'LEAVE');
  }, [sdk, exec]);

  const startTable = useCallback(async (gameId: bigint) => {
    return exec(
      'Starting table (computing aggregate key, encrypting deck)...',
      () => sdk!.startTable(gameId),
      'START',
    );
  }, [sdk, exec]);

  const shuffle = useCallback(async (gameId: bigint) => {
    return exec(
      'Shuffling deck (generating ZK proof ~10s)...',
      () => sdk!.shuffle(gameId, secretKey),
      'SHUFFLE',
    );
  }, [sdk, secretKey, exec]);

  const startHand = useCallback(async (gameId: bigint) => {
    return exec(
      'Starting hand (dealing cards, posting blinds)...',
      () => sdk!.startHand(gameId),
      'HAND',
    );
  }, [sdk, exec]);

  const prepareNewHand = useCallback(async (gameId: bigint) => {
    return exec(
      'Preparing new hand (computing new APK, encrypting deck)...',
      () => sdk!.newHand(gameId),
      'NEW_HAND',
    );
  }, [sdk, exec]);

  const submitRevealToken = useCallback(async (gameId: bigint, cardIndex: number) => {
    return exec(
      `Submitting reveal token for card ${cardIndex}...`,
      () => sdk!.submitRevealToken(gameId, cardIndex, secretKey),
      'REVEAL',
    );
  }, [sdk, secretKey, exec]);

  /**
   * Decrypt a card locally WITHOUT writing the value on-chain.
   * Used for hole cards to keep them private until showdown.
   */
  const decryptLocal = useCallback(async (gameId: bigint, cardIndex: number): Promise<number | null> => {
    if (!sdk) return null;
    setLoading(true);
    setLoadingMessage(`Decrypting card ${cardIndex} locally...`);
    setError(null);

    try {
      const contract = sdk.getContract();
      const numPlayers = await contract.getGamePlayers(gameId);
      const card = await contract.getDeckCard(gameId, cardIndex);
      const tokens: Point[] = [];
      for (let p = 0; p < numPlayers; p++) {
        // Only collect tokens from active players
        try {
          const active = await contract.isPlayerActiveInHand(gameId, p);
          if (!active) continue;
        } catch { /* backward compat: treat all as active */ }
        const token = await contract.getRevealToken(gameId, cardIndex, p);
        tokens.push(token);
      }

      const decryptedPoint = decryptWithTokens(card.c2, tokens);
      const value = lookupCard(decryptedPoint, cardTableRef.current);

      if (value < 0) {
        addLog('ERROR', `Card ${cardIndex} local decrypt failed!`);
        setError(`Card ${cardIndex} decryption failed`);
        return null;
      }

      addLog('DECRYPT', `Card ${cardIndex} decrypted locally (private)`);
      return value;
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      addLog('ERROR', `Local decrypt card ${cardIndex} failed: ${msg}`);
      return null;
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [sdk, addLog]);

  const decryptAndUnmask = useCallback(async (gameId: bigint, cardIndex: number): Promise<number | null> => {
    if (!sdk) return null;
    setLoading(true);
    setLoadingMessage(`Decrypting card ${cardIndex}...`);
    setError(null);

    try {
      const contract = sdk.getContract();
      const numPlayers = await contract.getGamePlayers(gameId);

      // Fetch encrypted card and all reveal tokens (from active players only)
      const card = await contract.getDeckCard(gameId, cardIndex);
      const tokens: Point[] = [];
      for (let p = 0; p < numPlayers; p++) {
        try {
          const active = await contract.isPlayerActiveInHand(gameId, p);
          if (!active) continue;
        } catch { /* backward compat: treat all as active */ }
        const token = await contract.getRevealToken(gameId, cardIndex, p);
        tokens.push(token);
      }

      // Decrypt locally
      const decryptedPoint = decryptWithTokens(card.c2, tokens);
      const value = lookupCard(decryptedPoint, cardTableRef.current);

      if (value < 0) {
        addLog('ERROR', `Card ${cardIndex} lookup failed!`);
        setError(`Card ${cardIndex} decryption failed`);
        return null;
      }

      // Unmask on-chain
      const txHash = await sdk.unmaskCard(gameId, cardIndex, value);
      addLog('UNMASK', `Card ${cardIndex} decrypted (value=${value})`, txHash);

      return value;
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      addLog('ERROR', `Decrypt card ${cardIndex} failed: ${msg}`);
      return null;
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [sdk, addLog]);

  const advancePhase = useCallback(async (gameId: bigint) => {
    return exec(
      'Advancing phase...',
      () => sdk!.advancePhase(gameId),
      'PHASE',
    );
  }, [sdk, exec]);

  const fold = useCallback(async (gameId: bigint) => {
    return exec('Folding...', () => sdk!.fold(gameId), 'BET');
  }, [sdk, exec]);

  const check = useCallback(async (gameId: bigint) => {
    return exec('Checking...', () => sdk!.check(gameId), 'BET');
  }, [sdk, exec]);

  const call = useCallback(async (gameId: bigint) => {
    return exec('Calling...', () => sdk!.call(gameId), 'BET');
  }, [sdk, exec]);

  const raise = useCallback(async (gameId: bigint, amount: bigint) => {
    return exec(`Raising ${amount}...`, () => sdk!.raise(gameId, amount), 'BET');
  }, [sdk, exec]);

  const verifyHoleCards = useCallback(async (gameId: bigint, playerIndex: number) => {
    return exec(
      `Verifying hole cards for Player ${playerIndex + 1}...`,
      () => sdk!.verifyHoleCards(gameId, playerIndex),
      'VERIFY',
    );
  }, [sdk, exec]);

  const showdown = useCallback(async (gameId: bigint) => {
    return exec('Showdown (evaluating hands)...', () => sdk!.showdown(gameId), 'SHOWDOWN');
  }, [sdk, exec]);

  return {
    createTable,
    joinTable,
    leaveTable,
    startTable,
    shuffle,
    startHand,
    prepareNewHand,
    submitRevealToken,
    decryptLocal,
    decryptAndUnmask,
    advancePhase,
    verifyHoleCards,
    fold,
    check,
    call,
    raise,
    showdown,
    loading,
    loadingMessage,
    error,
    setError,
  };
}
