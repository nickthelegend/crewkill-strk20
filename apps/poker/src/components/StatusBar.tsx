import { PHASE_NAMES } from '../types';
import { PLAYER_TEXT_COLORS } from '../constants';

interface Props {
  pokerPhase: number;
  pot: bigint;
  isMyTurn: boolean;
  gameState: number;
  playerNumber: number;
  loading: boolean;
  loadingMessage: string;
}

const GAME_STATE_NAMES: Record<number, string> = {
  0: 'Created',
  1: 'Registration',
  2: 'Shuffle',
  3: 'Playing',
  4: 'Complete',
};

export function StatusBar({ pokerPhase, pot, isMyTurn, gameState, playerNumber, loading, loadingMessage }: Props) {
  const phaseName = PHASE_NAMES[pokerPhase] ?? '';
  const stateName = GAME_STATE_NAMES[gameState] ?? '';

  return (
    <div className="flex-shrink-0 bg-black/50 backdrop-blur-md border-b border-white/[0.08] px-5 py-2.5 flex items-center justify-between">
      {/* Left: identity + state */}
      <div className="flex items-center gap-3 text-xs">
        <span className={`font-semibold px-2.5 py-0.5 rounded-full border tracking-wider ${PLAYER_TEXT_COLORS[(playerNumber - 1)] ?? 'text-blue-300'} border-white/20 bg-white/5`}>
          P{playerNumber}
        </span>
        <span className="text-white/30 uppercase tracking-widest text-[10px]">{stateName}</span>
        {gameState === 3 && phaseName && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-teal-400/70 text-[10px] uppercase tracking-widest">{phaseName}</span>
          </>
        )}
      </div>

      {/* Right: pot + status */}
      <div className="flex items-center gap-4 text-xs">
        {gameState === 3 && pot > 0n && (
          <span className="text-yellow-400/80 font-mono tabular-nums text-[11px]">
            <span className="text-white/20 uppercase tracking-wider mr-1.5 text-[9px]">Pot</span>
            {pot.toString()}
          </span>
        )}
        {loading ? (
          <span className="flex items-center gap-2 text-white/40">
            <span className="w-3 h-3 rounded-full border border-white/20 border-t-white/60 animate-spin inline-block" />
            <span className="max-w-[200px] truncate text-[10px] uppercase tracking-wider">{loadingMessage}</span>
          </span>
        ) : isMyTurn ? (
          <span className="font-semibold text-white pulse-active px-3 py-0.5 rounded-full border border-white/20 text-[10px] uppercase tracking-widest">
            Your Turn
          </span>
        ) : (
          <span className="text-white/20 text-[10px] uppercase tracking-widest">Waiting</span>
        )}
      </div>
    </div>
  );
}
