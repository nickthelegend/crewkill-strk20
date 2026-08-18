import { CardView } from '../components/CardView';
import { CommunityCards } from '../components/CommunityCards';
import type { CardSlot, PolledState } from '../types';
import { PLAYER_TEXT_COLORS } from '../constants';

interface Props {
  playerNumber: number;
  myPlayerIndex: number;
  polledState: PolledState;
  myHoleCards: CardSlot[];
  otherPlayersHoleCards: Map<number, CardSlot[]>;
  communityCards: CardSlot[];
  onPlayAgain: () => void;
}

function HoleCards({ cards }: { cards: CardSlot[] }) {
  const slots = cards.length > 0
    ? cards.map(c => ({ ...c, faceUp: c.value !== null ? true : c.faceUp }))
    : [null, null];
  return (
    <div className="flex gap-1.5">
      {slots.map((card, i) => (
        <CardView key={i} card={card as CardSlot | null} size="sm" />
      ))}
    </div>
  );
}

export function ResultsScreen({
  playerNumber,
  myPlayerIndex,
  polledState,
  myHoleCards,
  otherPlayersHoleCards,
  communityCards,
  onPlayAgain,
}: Props) {
  const { numPlayers, stacks } = polledState;

  const myStack = stacks[myPlayerIndex] ?? 0n;
  const delta = myStack - 1000n;
  const deltaStr = delta > 0n ? `+${delta}` : delta.toString();

  // Find the winner(s) — highest stack
  const maxStack = stacks.reduce((a, b) => (a > b ? a : b), 0n);
  const iWon = myStack === maxStack && stacks.filter(s => s === maxStack).length === 1;
  const isDraw = stacks.filter(s => s === maxStack).length > 1 && myStack === maxStack;
  const iLost = myStack < maxStack;

  const outcomeColor = isDraw ? 'text-white/50' : iWon ? 'text-emerald-400' : 'text-red-400';
  const deltaColor = delta > 0n ? 'text-emerald-400' : delta < 0n ? 'text-red-400' : 'text-white/30';

  // Build ordered list: me first, then others sorted by index
  const playerOrder = [myPlayerIndex, ...Array.from({ length: numPlayers }, (_, i) => i).filter(i => i !== myPlayerIndex)];

  return (
    <div className="h-screen flex overflow-hidden relative">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/assets/game-bg.mp4"
        autoPlay loop muted playsInline
      />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 p-8">

        {/* Outcome header */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-3">Result</p>
          <h1 className={`text-6xl font-bold tracking-tight ${outcomeColor}`}>
            {isDraw ? 'Split Pot' : iWon ? 'You Win' : 'You Lose'}
          </h1>
          {!isDraw && (
            <p className={`text-xl font-mono tabular-nums mt-2 ${deltaColor}`}>{deltaStr}</p>
          )}
        </div>

        {/* Main panel */}
        <div className="w-full max-w-2xl flex flex-col bg-black/40 backdrop-blur-sm border border-white/[0.07] rounded-2xl overflow-hidden">

          {/* Board */}
          {communityCards.some(c => c.value !== null) && (
            <div className="flex flex-col items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
              <span className="text-[9px] uppercase tracking-[0.25em] text-white/20">Board</span>
              <CommunityCards
                cards={communityCards.map(c => ({ ...c, faceUp: c.value !== null ? true : c.faceUp }))}
                size="md"
              />
            </div>
          )}

          {/* Player hands */}
          {playerOrder.map((pIdx) => {
            const isMe = pIdx === myPlayerIndex;
            const pStack = stacks[pIdx] ?? 0n;
            const pIsWinner = pStack === maxStack;
            const cards = isMe ? myHoleCards : (otherPlayersHoleCards.get(pIdx) ?? []);
            const colorClass = PLAYER_TEXT_COLORS[pIdx] ?? PLAYER_TEXT_COLORS[0];

            return (
              <div
                key={pIdx}
                className={`flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06] last:border-b-0 ${pIsWinner ? 'bg-emerald-950/20' : ''}`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    {pIsWinner && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${colorClass}`}>
                      Player {pIdx + 1}{isMe ? ' · You' : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/20 tabular-nums pl-3.5">
                    {pIsWinner ? 'Winner · ' : ''}{pStack.toString()}
                  </span>
                </div>
                <HoleCards cards={cards} />
              </div>
            );
          })}

        </div>

        {/* Play again */}
        <button
          onClick={onPlayAgain}
          className="mt-2 px-10 py-2.5 border border-white/15 hover:border-white/35 hover:bg-white/[0.04] rounded-xl text-[11px] font-medium text-white/40 hover:text-white/70 uppercase tracking-widest transition-all duration-200"
        >
          Play Again
        </button>

      </div>
    </div>
  );
}
