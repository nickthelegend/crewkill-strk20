import { CardView } from './CardView';
import type { CardSlot } from '../types';

interface Props {
  name: string;
  stack: bigint;
  currentBet: bigint;
  folded: boolean;
  allIn: boolean;
  isActive: boolean;
  isMe: boolean;
  holeCards: CardSlot[];
  colorClass: string;
}

export function PlayerSeat({
  name,
  stack,
  currentBet,
  folded,
  allIn,
  isActive,
  isMe,
  holeCards,
  colorClass,
}: Props) {
  const cardSize = isMe ? 'xl' : 'lg';

  return (
    <div className={`flex flex-col items-center gap-2 ${folded ? 'opacity-40' : ''}`}>
      {/* Cards */}
      <div className="flex gap-2">
        {holeCards.length > 0 ? (
          holeCards.map((card, i) => (
            <CardView key={i} card={card} size={cardSize} />
          ))
        ) : (
          <>
            <CardView card={null} size={cardSize} />
            <CardView card={null} size={cardSize} />
          </>
        )}
      </div>

      {/* Name + stack badge */}
      <div className={`
        flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border
        ${colorClass}
        ${isActive
          ? 'pulse-active bg-white/5 border-white/30'
          : 'bg-gray-900/80 border-gray-700/50'
        }
      `}>
        <span className="text-white">{name}{isMe ? ' (you)' : ''}</span>
        <span className="text-gray-500">·</span>
        <span className="text-yellow-300 font-mono">{stack.toString()}</span>
        {currentBet > 0n && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-amber-400">bet {currentBet.toString()}</span>
          </>
        )}
        {folded && <span className="text-red-400 font-bold">FOLD</span>}
        {allIn && <span className="text-orange-400 font-bold">ALL IN</span>}
      </div>
    </div>
  );
}
