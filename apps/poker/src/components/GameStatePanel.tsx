import { PHASE_NAMES } from '../types';
import type { PolledState } from '../types';

interface Props {
  polledState: PolledState;
  myPlayerIndex: number;
}

const GAME_STATE_LABELS: Record<number, string> = {
  0: 'Created',
  1: 'Registration',
  2: 'Shuffling',
  3: 'Playing',
  4: 'Complete',
};

const PHASE_ICONS: Record<number, string> = {
  0: '·',
  1: '⟳',
  2: '◈',
  3: '◈',
  4: '◈',
};

export function GameStatePanel({ polledState, myPlayerIndex }: Props) {
  const { gameState, pokerPhase, pot, actionPlayer } = polledState;
  const phaseName = PHASE_NAMES[pokerPhase] ?? '';
  const stateName = GAME_STATE_LABELS[gameState] ?? '';
  const isMyTurn = actionPlayer === myPlayerIndex && gameState === 3;

  return (
    <div className="flex flex-col gap-2 p-3 bg-black/40 backdrop-blur-sm border border-white/8 rounded-2xl text-xs">
      {/* Phase / State */}
      <div className="flex items-center gap-2 text-white/50 uppercase tracking-wider">
        <span className="text-white/30">{PHASE_ICONS[gameState] ?? '·'}</span>
        <span>{stateName}</span>
        {gameState === 3 && phaseName && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-teal-400">{phaseName}</span>
          </>
        )}
      </div>

      {/* Pot */}
      {gameState === 3 && pot > 0n && (
        <div className="flex items-center justify-between">
          <span className="text-white/40 uppercase tracking-wider">Pot</span>
          <span className="text-yellow-400 font-mono tabular-nums font-semibold">{pot.toString()}</span>
        </div>
      )}

      {/* Turn indicator */}
      {gameState === 3 && (
        <div className={`text-center py-1 rounded-lg border text-xs uppercase tracking-wider font-medium ${
          isMyTurn
            ? 'border-white/25 text-white bg-white/5 pulse-active'
            : 'border-white/8 text-white/30'
        }`}>
          {isMyTurn ? 'Your Turn' : `Player ${actionPlayer + 1}'s Turn`}
        </div>
      )}
    </div>
  );
}
