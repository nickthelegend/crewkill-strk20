import { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  onHide?: () => void;
}

// Phases that represent major milestones → rendered as section headers
const SECTION_PHASES = new Set(['CREATE', 'START', 'SHUFFLE', 'HAND', 'PHASE', 'SHOWDOWN']);

const SECTION_COLORS: Record<string, string> = {
  CREATE:   'text-purple-400 border-purple-500/25',
  START:    'text-cyan-400   border-cyan-500/25',
  SHUFFLE:  'text-indigo-400 border-indigo-500/25',
  HAND:     'text-green-400  border-green-500/25',
  PHASE:    'text-teal-400   border-teal-500/25',
  SHOWDOWN: 'text-orange-400 border-orange-500/25',
};

const ENTRY_COLORS: Record<string, string> = {
  REVEAL:  'text-yellow-400/70',
  DECRYPT: 'text-blue-400/55',
  UNMASK:  'text-emerald-400/80',
  BET:     'text-amber-400/85',
  JOIN:    'text-blue-400/80',
  ERROR:   'text-red-400',
  INFO:    'text-white/30',
};

function cleanMessage(phase: string, raw: string): string {
  let msg = raw.replace(/^Auto:\s*/i, '');
  switch (phase) {
    case 'REVEAL':
      msg = msg.replace(/Submitting reveal (?:token )?for card (\d+)\.*/i, 'Reveal token → card $1');
      break;
    case 'DECRYPT':
      msg = msg.replace(/Decrypting card (\d+)(?:\s+locally[^)]*)?\.*/i, 'Decrypt card $1…');
      msg = msg.replace(/Card (\d+) decrypted(?: locally[^)]*)?/i, 'Card $1 decrypted ✓');
      break;
    case 'UNMASK':
      msg = msg.replace(/Card (\d+) decrypted \(value=(\d+)\)/i, 'Card $1 → #$2');
      break;
    case 'BET':
      msg = msg.replace(/Folding\.*/i, 'Fold')
               .replace(/Checking\.*/i, 'Check')
               .replace(/Calling\.*/i, 'Call')
               .replace(/Raising (\S+)\.*/i, 'Raise $1');
      break;
    case 'ERROR': {
      // Strip the leading "X... failed: " prefix added by exec(), keep the reason
      const failedIdx = msg.indexOf(' failed: ');
      if (failedIdx !== -1) msg = msg.slice(failedIdx + 9);
      // Cap length so long contract errors don't stretch the log
      if (msg.length > 80) msg = msg.slice(0, 80) + '…';
      break;
    }
    case 'INFO':
      msg = msg.replace(/Initializing as Player (\d+)\.*/i, 'Init Player $1')
               .replace(/Player \d+ initialized.*/i, 'Player ready')
               .replace(/Game started!.*/, 'Entering game…')
               .replace(/Starting table\.*/i, 'Starting table')
               .replace(/Shuffling deck\.*/i, 'Shuffling deck')
               .replace(/Starting hand\.*/i, 'Dealing hand')
               .replace(/Advancing phase\.*/i, '');
      break;
  }
  return msg.trim();
}

function sectionLabel(phase: string, message: string): string {
  if (phase === 'PHASE') {
    const m = message.match(/\b(PreFlop|Pre.?Flop|Flop|Turn|River|Showdown)\b/i);
    return m ? m[1] : 'New Phase';
  }
  const labels: Record<string, string> = {
    CREATE: 'New Game', START: 'Game Started',
    SHUFFLE: 'Shuffling Deck', HAND: 'Hand Dealt', SHOWDOWN: 'Showdown',
  };
  return labels[phase] ?? phase;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function EventLog({ logs, onHide }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="flex-shrink-0 w-65 h-full flex flex-col border-l border-white/[0.06] bg-black/30 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">Event Log</span>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span className="text-[10px] text-white/15 tabular-nums">{logs.length}</span>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="text-[10px] text-white/40 hover:text-white/80 uppercase tracking-widest"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {/* Entries */}
      <div ref={scrollRef} className="action-log flex-1 overflow-y-auto">
        {logs.length === 0 && (
          <div className="text-white/15 text-center py-8 text-[10px] uppercase tracking-widest">No events yet</div>
        )}

        {(() => {
          let lastSectionKey = '';
          return logs.flatMap((log) => {
            if (SECTION_PHASES.has(log.phase)) {
              const label = sectionLabel(log.phase, log.message);
              const sectionKey = `${log.phase}:${label}`;
              // Skip duplicate consecutive section headers
              if (sectionKey === lastSectionKey) return [];
              lastSectionKey = sectionKey;
              const colors = SECTION_COLORS[log.phase] ?? 'text-white/40 border-white/10';
              const [textColor, borderColor] = colors.split(' ');
              return [(
                <div key={log.id} className="px-3 pt-4 pb-2">
                  <div className={`flex items-center gap-2 border-b pb-1 ${borderColor}`}>
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${textColor}`}>
                      {label}
                    </span>
                    <span className="text-white/15 text-[9px] ml-auto tabular-nums">{fmt(log.timestamp)}</span>
                  </div>
                </div>
              )];
            }

            const color = ENTRY_COLORS[log.phase] ?? 'text-white/30';
            const msg = cleanMessage(log.phase, log.message);
            // Skip entries with no visible content
            if (!msg) return [];

            return [(
              <div key={log.id} className="px-3 py-0.5 flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                  <span className="text-white/15 text-[9px] tabular-nums mt-0.5 shrink-0">{fmt(log.timestamp)}</span>
                  <span className={`text-[10px] font-mono leading-relaxed break-words min-w-0 ${color}`}>{msg}</span>
                  {log.duration && (
                    <span className="text-white/10 text-[9px] shrink-0 ml-auto mt-0.5 tabular-nums">{log.duration}ms</span>
                  )}
                </div>
                {log.txHash && (
                  <a
                    href={`https://sepolia.voyager.online/tx/${log.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-[52px] text-[9px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors truncate"
                  >
                    tx {log.txHash.slice(0, 10)}...{log.txHash.slice(-6)}
                  </a>
                )}
              </div>
            )];
          });
        })()}
        <div className="h-3" />
      </div>
    </div>
  );
}
