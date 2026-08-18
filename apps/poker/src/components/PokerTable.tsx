import { useMemo } from 'react';
import { CardView } from './CardView';
import { CommunityCards } from './CommunityCards';
import type { CardSlot, PolledState } from '../types';
import { PLAYER_COLORS } from '../constants';

interface Props {
  polledState: PolledState;
  myPlayerIndex: number;
  myHoleCards: CardSlot[];
  otherPlayersHoleCards: Map<number, CardSlot[]>;
  communityCards: CardSlot[];
}

// 7 profile pictures available — assign deterministically per game so no duplicates
const TOTAL_PROFILE_PICS = 7;

function useProfilePics(numPlayers: number, gameId: bigint | null): number[] {
  return useMemo(() => {
    // Seed from gameId so same game = same assignment, but different games = different
    const seed = gameId !== null ? Number(gameId % 1000n) : 0;
    const available = Array.from({ length: TOTAL_PROFILE_PICS }, (_, i) => i + 1);
    // Fisher-Yates shuffle with deterministic seed
    let s = seed;
    for (let i = available.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available.slice(0, numPlayers);
  }, [numPlayers, gameId]);
}

function HoleCards({ cards, size }: { cards: CardSlot[]; size: 'sm' | 'md' | 'xl' }) {
  const slots = cards.length > 0 ? cards : [null, null];
  return (
    <div className="flex items-center">
      {slots.map((card, i) => (
        <div
          key={i}
          className={i === 1 ? '-ml-3' : ''}
          style={{
            transform: `rotate(${i === 0 ? -4 : 4}deg)`,
            transformOrigin: i === 0 ? 'right bottom' : 'left bottom',
            zIndex: i === 0 ? 10 : 11,
          }}
        >
          <CardView card={card as CardSlot | null} size={size} />
        </div>
      ))}
    </div>
  );
}

// Chip color tiers by value
const CHIP_TIERS = [
  { min: 1000n, bg: 'bg-yellow-400',  ring: 'ring-yellow-600',  text: 'text-yellow-900' },
  { min: 500n,  bg: 'bg-purple-500',  ring: 'ring-purple-700',  text: 'text-white'      },
  { min: 100n,  bg: 'bg-neutral-800', ring: 'ring-neutral-500', text: 'text-white'      },
  { min: 25n,   bg: 'bg-green-500',   ring: 'ring-green-700',   text: 'text-white'      },
  { min: 5n,    bg: 'bg-red-500',     ring: 'ring-red-700',     text: 'text-white'      },
  { min: 0n,    bg: 'bg-slate-100',   ring: 'ring-slate-300',   text: 'text-slate-800'  },
] as const;

function chipTier(amount: bigint) {
  return CHIP_TIERS.find(t => amount >= t.min) ?? CHIP_TIERS[CHIP_TIERS.length - 1];
}

function fmtChips(n: bigint) {
  if (n >= 10000n) return `${Math.round(Number(n) / 1000)}k`;
  if (n >= 1000n)  return `${(Number(n) / 1000).toFixed(Number(n % 1000n) === 0 ? 0 : 1)}k`;
  return n.toString();
}

function BetChip({ amount }: { amount: bigint }) {
  const tier = chipTier(amount);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-8 h-8">
        {[2, 1, 0].map(i => (
          <div
            key={i}
            className={`absolute w-7 h-7 rounded-full ${tier.bg} ring-2 ${tier.ring} shadow-md`}
            style={{ bottom: i * 2, left: '50%', transform: 'translateX(-50%)' }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[8px] font-bold ${tier.text} tabular-nums z-10`}>
            {fmtChips(amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Dealer button indicator */
function DealerButton() {
  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center ring-2 ring-yellow-400/60 z-20">
      <span className="text-[7px] font-black text-black tracking-tight">D</span>
    </div>
  );
}

/** Player badge with profile picture */
function PlayerBadge({
  name, stack, folded, allIn, isActive, colorClass, isMe, isDealer, profilePic,
}: {
  name: string; stack: bigint; folded: boolean; allIn: boolean;
  isActive: boolean; colorClass: string; isMe: boolean; isDealer: boolean;
  profilePic: number;
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${folded ? 'opacity-40' : ''}`}>
      {/* Turn indicator */}
      {isActive && (
        <div className="text-[10px] text-white font-bold uppercase tracking-widest pulse-active px-3 py-0.5 rounded-full bg-white/10 border border-white/25">
          {isMe ? 'Your Turn' : 'Acting'}
        </div>
      )}

      {/* Avatar + info row */}
      <div className={`
        flex items-center gap-2.5 pl-1 pr-3.5 py-1 rounded-full
        bg-black/80 backdrop-blur-sm border whitespace-nowrap
        ${isActive ? `pulse-active ${colorClass}` : 'border-white/[0.08]'}
      `}>
        {/* Profile picture */}
        <div className="relative flex-shrink-0">
          <img
            src={`/profile-pics/${profilePic}.png`}
            alt={name}
            className={`w-12 h-12 rounded-full object-cover ring-2 ${
              isActive ? 'ring-white/60' : isMe ? 'ring-white/30' : 'ring-white/10'
            }`}
          />
          {isDealer && <DealerButton />}
        </div>

        {/* Name + stack */}
        <div className="flex flex-col leading-tight">
          <span className={`text-xs font-semibold ${isMe ? 'text-white' : 'text-white/80'}`}>
            {name}{isMe ? ' (You)' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-yellow-300 font-mono tabular-nums font-semibold">{fmtChips(stack)}</span>
            {allIn && (
              <span className="text-[8px] text-orange-400 uppercase tracking-wider font-bold">All In</span>
            )}
            {folded && (
              <span className="text-[8px] text-red-400/80 uppercase tracking-wider font-bold">Fold</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Seat positions around the oval table.
 */
function getSeatPositions(numPlayers: number, myPlayerIndex: number): {
  playerIndex: number;
  badgeStyle: React.CSSProperties;
  cardsStyle: React.CSSProperties;
  betStyle: React.CSSProperties;
}[] {
  type SeatTemplate = {
    badge: React.CSSProperties;
    cards: React.CSSProperties;
    bet: React.CSSProperties;
  };

  const seatTemplates: Record<number, SeatTemplate[]> = {
    2: [
      {
        badge: { bottom: '-60px', left: '50%', transform: 'translateX(-50%)' },
        cards: { bottom: '8px', left: '50%', transform: 'translateX(-50%)' },
        bet:   { bottom: '28%', left: '50%', transform: 'translateX(-50%)' },
      },
      {
        badge: { top: '-60px', left: '50%', transform: 'translateX(-50%)' },
        cards: { top: '4px', left: '50%', transform: 'translateX(-50%)' },
        bet:   { top: '26%', left: '50%', transform: 'translateX(-50%)' },
      },
    ],
    3: [
      {
        badge: { bottom: '-60px', left: '50%', transform: 'translateX(-50%)' },
        cards: { bottom: '8px', left: '50%', transform: 'translateX(-50%)' },
        bet:   { bottom: '28%', left: '50%', transform: 'translateX(-50%)' },
      },
      {
        badge: { top: '-60px', right: '8%' },
        cards: { top: '4px', right: '8%' },
        bet:   { top: '26%', right: '26%' },
      },
      {
        badge: { top: '-60px', left: '8%' },
        cards: { top: '4px', left: '8%' },
        bet:   { top: '26%', left: '26%' },
      },
    ],
    4: [
      {
        badge: { bottom: '-60px', left: '50%', transform: 'translateX(-50%)' },
        cards: { bottom: '8px', left: '50%', transform: 'translateX(-50%)' },
        bet:   { bottom: '28%', left: '50%', transform: 'translateX(-50%)' },
      },
      {
        badge: { top: 'calc(50% + 78px)', right: '2%' },
        cards: { top: '50%', right: '2%', transform: 'translateY(-50%)' },
        bet:   { top: '50%', right: '33%', transform: 'translateY(-50%)' },
      },
      {
        badge: { top: '-60px', left: '50%', transform: 'translateX(-50%)' },
        cards: { top: '4px', left: '50%', transform: 'translateX(-50%)' },
        bet:   { top: '26%', left: '50%', transform: 'translateX(-50%)' },
      },
      {
        badge: { top: 'calc(50% + 78px)', left: '2%' },
        cards: { top: '50%', left: '2%', transform: 'translateY(-50%)' },
        bet:   { top: '50%', left: '33%', transform: 'translateY(-50%)' },
      },
    ],
  };

  const templates = seatTemplates[numPlayers] ?? seatTemplates[2];

  return Array.from({ length: numPlayers }, (_, seatIdx) => ({
    playerIndex: (myPlayerIndex + seatIdx) % numPlayers,
    badgeStyle: templates[seatIdx].badge,
    cardsStyle: templates[seatIdx].cards,
    betStyle:   templates[seatIdx].bet,
  }));
}

export function PokerTable({
  polledState,
  myPlayerIndex,
  myHoleCards,
  otherPlayersHoleCards,
  communityCards,
}: Props) {
  const { numPlayers, stacks, bets, folded, allIn, actionPlayer, pot, pokerPhase, gameState, handNumber, gameId } = polledState;
  const seats = getSeatPositions(numPlayers || 2, myPlayerIndex);

  // Dealer rotates each hand
  const dealerIndex = numPlayers > 0 ? handNumber % numPlayers : 0;

  // Deterministic profile pic assignment (no duplicates within a game)
  const profilePics = useProfilePics(numPlayers || 2, gameId);

  return (
    <div className="flex flex-col items-center">

      {/* Table rim — oval shape */}
      <div
        className="poker-table-rim relative"
        style={{
          width: 'clamp(640px, 74vw, 1200px)',
          height: 'clamp(540px, 72vh, 980px)',
        }}
      >
        {/* Felt surface */}
        <div className="poker-table absolute" style={{ inset: '22px' }}>

          {/* Cards on felt */}
          {seats.map((seat) => {
            const isMe = seat.playerIndex === myPlayerIndex;
            const cards = isMe
              ? myHoleCards
              : (otherPlayersHoleCards.get(seat.playerIndex) ?? []);
            const cardSize = isMe ? 'md' : 'sm';
            return (
              <div key={`cards-${seat.playerIndex}`} className="absolute z-10" style={seat.cardsStyle}>
                <HoleCards cards={cards} size={cardSize} />
              </div>
            );
          })}

          {/* Bet chips */}
          {seats.map((seat) => {
            const bet = bets[seat.playerIndex] ?? 0n;
            if (bet <= 0n) return null;
            return (
              <div key={`bet-${seat.playerIndex}`} className="absolute z-10" style={seat.betStyle}>
                <BetChip amount={bet} />
              </div>
            );
          })}

          {/* Joker logo — always centered behind everything */}
          <a href="https://play.jokersofneon.com/" target="_blank" rel="noopener noreferrer"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] opacity-30 hover:opacity-100 transition-all duration-300 hover:scale-150 hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
          >
            <img src="/joker-logo.png" alt="Jokers of Neon" className="w-28 h-28 object-contain" />
          </a>

          {/* Center: community cards + pot */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 z-10 px-4">
            {gameState === 3 && pokerPhase >= 2 && (
              <CommunityCards cards={communityCards} />
            )}

            {gameState === 3 && pot > 0n && (
              <div className="flex items-center gap-2 bg-black/50 px-5 py-2 rounded-full border border-yellow-500/15">
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-600"
                      style={{ transform: `translateY(${-i}px)` }}
                    />
                  ))}
                </div>
                <span className="text-yellow-400 font-bold text-lg tabular-nums">
                  {fmtChips(pot)}
                </span>
                <span className="text-yellow-600/50 text-[10px] uppercase tracking-wider">pot</span>
              </div>
            )}

            {gameState < 3 && (
              <div className="flex flex-col items-center gap-2">
                <div className="text-white/25 text-sm text-center uppercase tracking-widest">
                  {gameState === 1 && 'Waiting for players...'}
                  {gameState === 2 && 'Shuffling deck...'}
                </div>
                {gameState === 2 && (
                  <div className="w-6 h-6 rounded-full border border-white/20 border-t-white/60 animate-spin" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Player badges — positioned relative to the RIM */}
        {seats.map((seat) => (
          <div key={`badge-${seat.playerIndex}`} className="absolute z-30" style={seat.badgeStyle}>
            <PlayerBadge
              name={`P${seat.playerIndex + 1}`}
              stack={stacks[seat.playerIndex] ?? 0n}
              folded={folded[seat.playerIndex] ?? false}
              allIn={allIn[seat.playerIndex] ?? false}
              isActive={actionPlayer === seat.playerIndex && gameState === 3}
              colorClass={PLAYER_COLORS[seat.playerIndex] ?? PLAYER_COLORS[0]}
              isMe={seat.playerIndex === myPlayerIndex}
              isDealer={seat.playerIndex === dealerIndex}
              profilePic={profilePics[seat.playerIndex] ?? 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
