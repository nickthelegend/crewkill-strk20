import { SUITS, RANKS, SUIT_SYMBOLS } from '../constants';

export interface CardInfo {
  suit: typeof SUITS[number];
  rank: typeof RANKS[number];
  symbol: string;
  color: 'red' | 'black';
  label: string; // e.g. "A\u2660"
}

/**
 * Convert a 0-based card value (0-51) to card info.
 * Layout: 0-12 = A-K of spades, 13-25 = hearts, 26-38 = diamonds, 39-51 = clubs
 */
export function cardFromValue(value: number): CardInfo {
  const suitIdx = Math.floor(value / 13);
  const rankIdx = value % 13;
  const suit = SUITS[suitIdx];
  const rank = RANKS[rankIdx];
  const symbol = SUIT_SYMBOLS[suit];
  const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  return { suit, rank, symbol, color, label: `${rank}${symbol}` };
}
