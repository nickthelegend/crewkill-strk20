import { useState, useMemo } from 'react';

interface Props {
  options: ('fold' | 'check' | 'call' | 'raise')[];
  currentBet: bigint;
  myBet: bigint;
  myStack: bigint;
  pot: bigint;
  bigBlind: bigint;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: bigint) => void;
  disabled: boolean;
}

function fmtChips(n: bigint) {
  if (n >= 10000n) return `${Math.round(Number(n) / 1000)}k`;
  if (n >= 1000n)  return `${(Number(n) / 1000).toFixed(Number(n % 1000n) === 0 ? 0 : 1)}k`;
  return n.toString();
}

export function BettingPanel({
  options,
  currentBet,
  myBet,
  myStack,
  pot,
  bigBlind,
  onFold,
  onCheck,
  onCall,
  onRaise,
  disabled,
}: Props) {
  const callAmount = currentBet - myBet;
  const totalStack = myStack + myBet;
  const minRaise = currentBet + bigBlind;
  const maxRaise = totalStack;

  const presets = useMemo(() => {
    const clamp = (v: bigint) => {
      if (v < minRaise) return minRaise;
      if (v > maxRaise) return maxRaise;
      return v;
    };

    const totalPot = pot + callAmount;
    const items: { label: string; amount: bigint }[] = [];

    const threeBB = currentBet + bigBlind * 3n;
    if (threeBB <= maxRaise) {
      items.push({ label: '3 BB', amount: clamp(threeBB) });
    }

    const halfPot = currentBet + totalPot / 2n;
    if (halfPot > (items[items.length - 1]?.amount ?? 0n) && halfPot <= maxRaise) {
      items.push({ label: '1/2 Pot', amount: clamp(halfPot) });
    }

    const potBet = currentBet + totalPot;
    if (potBet > (items[items.length - 1]?.amount ?? 0n) && potBet <= maxRaise) {
      items.push({ label: 'Pot', amount: clamp(potBet) });
    }

    if (maxRaise > (items[items.length - 1]?.amount ?? 0n)) {
      items.push({ label: 'All In', amount: maxRaise });
    }

    return items;
  }, [currentBet, bigBlind, pot, callAmount, minRaise, maxRaise]);

  const [raiseAmount, setRaiseAmount] = useState<bigint>(minRaise);

  const canRaise = options.includes('raise') && maxRaise >= minRaise;

  const sliderMin = Number(minRaise);
  const sliderMax = Number(maxRaise);
  const sliderVal = Number(raiseAmount < minRaise ? minRaise : raiseAmount > maxRaise ? maxRaise : raiseAmount);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaiseAmount(BigInt(e.target.value));
  };

  const handlePreset = (amount: bigint) => {
    setRaiseAmount(amount);
  };

  const handleRaise = () => {
    const amt = raiseAmount < minRaise ? minRaise : raiseAmount > maxRaise ? maxRaise : raiseAmount;
    onRaise(amt);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Info bar: Stack + Pot + Blinds */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 uppercase tracking-wider text-[10px]">Stack</span>
          <span className="text-white font-mono tabular-nums font-semibold">{fmtChips(myStack)}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 uppercase tracking-wider text-[10px]">Pot</span>
          <span className="text-yellow-400 font-mono tabular-nums font-semibold">{fmtChips(pot)}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 uppercase tracking-wider text-[10px]">Blinds</span>
          <span className="text-white/60 font-mono tabular-nums">{fmtChips(bigBlind / 2n)}/{fmtChips(bigBlind)}</span>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center justify-center gap-2">
        {/* Main actions */}
        {options.includes('fold') && (
          <button
            onClick={onFold}
            disabled={disabled}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all disabled:opacity-40
              border border-red-500/40 text-red-400 bg-red-950/30 hover:bg-red-900/40 active:scale-95"
          >
            Fold
          </button>
        )}
        {options.includes('check') && (
          <button
            onClick={onCheck}
            disabled={disabled}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all disabled:opacity-40
              border border-emerald-500/40 text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 active:scale-95"
          >
            Check
          </button>
        )}
        {options.includes('call') && (
          <button
            onClick={onCall}
            disabled={disabled}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide transition-all disabled:opacity-40
              border border-blue-500/40 text-blue-400 bg-blue-950/30 hover:bg-blue-900/40 active:scale-95"
          >
            Call <span className="font-mono tabular-nums ml-1">{fmtChips(callAmount)}</span>
          </button>
        )}

        {/* Raise section */}
        {canRaise && (
          <>
            <div className="w-px h-8 bg-white/10 mx-1" />

            {/* Presets */}
            {presets.map((p) => {
              const isActive = raiseAmount === p.amount;
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.amount)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all disabled:opacity-40 active:scale-95
                    ${isActive
                      ? 'border border-amber-400/70 text-amber-300 bg-amber-500/20'
                      : 'border border-white/10 text-white/50 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/70'
                    }`}
                >
                  {p.label}
                </button>
              );
            })}

            {/* Slider */}
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={Number(bigBlind)}
              value={sliderVal}
              onChange={handleSlider}
              disabled={disabled}
              className="w-24 h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40 accent-amber-500
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10"
            />

            {/* Raise button */}
            <button
              onClick={handleRaise}
              disabled={disabled}
              className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-40 active:scale-[0.98]
                bg-gradient-to-r from-amber-600 to-amber-500 text-black hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/30"
            >
              Raise <span className="font-mono tabular-nums">{fmtChips(raiseAmount)}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
