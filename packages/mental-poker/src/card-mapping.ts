/** Card ranks: 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A */
const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS = ['\u2660', '\u2665', '\u2666', '\u2663']; // spades, hearts, diamonds, clubs
const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];

export interface CardInfo {
  rank: number;    // 0-12
  suit: number;    // 0-3
  rankName: string; // '2'..'A'
  suitName: string; // 'Spades'..'Clubs'
}

/** Convert a 0-indexed card value (0-51) to rank and suit info. */
export function cardToRankSuit(value: number): CardInfo {
  const rank = value % 13;
  const suit = Math.floor(value / 13);
  return {
    rank,
    suit,
    rankName: RANK_NAMES[rank],
    suitName: SUIT_NAMES[suit],
  };
}

/** Convert a 0-indexed card value to a display name like "A♠", "K♥". */
export function cardName(value: number): string {
  const rank = value % 13;
  const suit = Math.floor(value / 13);
  return RANK_NAMES[rank] + SUIT_SYMBOLS[suit];
}

/** Get a human-readable hand rank description. */
export function handDescription(rankValue: number): string {
  const descriptions = [
    'High Card',
    'Pair',
    'Two Pair',
    'Three of a Kind',
    'Straight',
    'Flush',
    'Full House',
    'Four of a Kind',
    'Straight Flush',
    'Royal Flush',
  ];
  return descriptions[rankValue] ?? 'Unknown';
}
