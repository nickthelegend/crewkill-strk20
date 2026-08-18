import { CardView } from './CardView';
import { CommunityCards } from './CommunityCards';
import type { HandResult, CardSlot } from '../types';
import { HAND_RANK_NAMES } from '../types';
import { PLAYER_TEXT_COLORS } from '../constants';
import { evaluateBestHand } from '../game/hand-evaluator';

interface Props {
  result: HandResult;
  myPlayerIndex: number;
  onDismiss: () => void;
}

function HoleCards({ cards }: { cards: CardSlot[] }) {
  // Force all cards face-up for the result overlay
  const visibleCards = cards.map(c => ({
    ...c,
    faceUp: c.value !== null ? true : c.faceUp,
  }));
  return (
    <div className="flex gap-1.5">
      {visibleCards.map((card, i) => (
        <CardView key={i} card={card} size="xs" />
      ))}
    </div>
  );
}

export function HandResultOverlay({ result, myPlayerIndex, onDismiss }: Props) {
  const iWon = result.winnerIndex === myPlayerIndex;
  const reasonText = result.reason === 'fold'
    ? 'Others folded'
    : (result.handRank !== undefined && result.handRank !== 0xFF
        ? HAND_RANK_NAMES[result.handRank] ?? 'Showdown'
        : 'Showdown');

  const commValues = result.communityCards.map(c => c.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg mx-4 bg-black/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/25 mb-2">
            Hand #{result.handNumber} Result
          </p>
          <h2 className={`text-3xl font-bold tracking-tight ${iWon ? 'text-emerald-400' : 'text-white/80'}`}>
            {iWon ? 'You Win!' : `Player ${result.winnerIndex + 1} Wins`}
          </h2>
          <p className="text-sm text-white/40 mt-1">
            {reasonText} &middot; +{result.amount.toString()} chips
          </p>
        </div>

        {/* Community cards */}
        {result.communityCards.some(c => c.value !== null) && (
          <div className="flex flex-col items-center gap-2 px-4 py-3 border-t border-white/[0.06]">
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/20">Board</span>
            <CommunityCards
              cards={result.communityCards.map(c => ({ ...c, faceUp: c.value !== null ? true : c.faceUp }))}
              size="xs"
            />
          </div>
        )}

        {/* Player stacks + cards */}
        <div className="border-t border-white/[0.06]">
          {result.stacks.map((stack, pIdx) => {
            const isWinner = pIdx === result.winnerIndex;
            const isMe = pIdx === myPlayerIndex;
            const colorClass = PLAYER_TEXT_COLORS[pIdx] ?? PLAYER_TEXT_COLORS[0];
            const cards = result.holeCards.get(pIdx) ?? [];

            // Evaluate hand rank from visible cards
            const holeValues = cards.map(c => c.value);
            const hand = evaluateBestHand(holeValues, commValues);
            const rankLabel = result.reason === 'fold' && isWinner
              ? 'Fold win'
              : (hand ? HAND_RANK_NAMES[hand.rank] ?? '' : '');

            return (
              <div
                key={pIdx}
                className={`flex items-center justify-between gap-3 px-5 py-2.5 border-b border-white/[0.04] last:border-b-0 ${isWinner ? 'bg-emerald-950/20' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isWinner && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
                    P{pIdx + 1}{isMe ? ' (You)' : ''}
                  </span>
                  <span className="text-[10px] text-white/20 tabular-nums">
                    {stack.toString()}
                  </span>
                  {rankLabel && (
                    <span className={`text-[9px] uppercase tracking-wider ${isWinner ? 'text-emerald-400/80' : 'text-white/25'}`}>
                      {rankLabel}
                    </span>
                  )}
                </div>
                {cards.length > 0 && <HoleCards cards={cards} />}
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <div className="flex justify-center py-4">
          <button
            onClick={onDismiss}
            className="px-8 py-2 border border-white/15 hover:border-white/35 hover:bg-white/[0.04] rounded-xl text-[11px] font-medium text-white/40 hover:text-white/70 uppercase tracking-widest transition-all duration-200"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
