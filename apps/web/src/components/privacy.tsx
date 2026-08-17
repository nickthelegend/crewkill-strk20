"use client";

import {
  assessPrivacy,
  auditMatch,
  type MatchView,
  type SeatKeypair,
} from"@crewkill/protocol";
import { useMemo, useState } from"react";
import { Panel } from"./pieces";

/**
 * What is actually public about *you*, right now.
 *
 * STRK20's compliance page is blunt that deposits and withdrawals name addresses and that
 *"distinctive patterns" narrow the anonymity set. A privacy product that does not say so
 * out loud is selling a feeling. This says so, and scores the parts a player controls.
 */
export function PrivacyLedger({
  match,
  seat,
  shieldedAt,
}: {
  match: MatchView;
  seat: SeatKeypair | null;
  shieldedAt: number | null;
}) {
  const assessment = useMemo(
    () =>
      assessPrivacy({
        shieldedSeparately: shieldedAt !== null,
        msBetweenShieldAndStake: shieldedAt === null ? null : Date.now() - shieldedAt,
        seatsInLobby: match.seatsFilled,
        uniformStake: true,
      }),
    [shieldedAt, match.seatsFilled],
  );

  const tone =
    assessment.band ==="strong"
      ?"var(--color-signal)"
      : assessment.band ==="fair"
        ?"var(--color-amber)"
        :"var(--color-alarm)";

  return (
    <Panel
      title="Your privacy"
      right={
        <span className="text-[11px]" style={{ color: tone }}>
          {assessment.band}
        </span>
      }
      className="bg-[var(--color-panel)]/90"
    >
      <div className="mb-3 h-1.5 overflow-hidden  bg-[var(--color-line)]">
        <div
          className="h-full  transition-[width] duration-700"
          style={{ width: `${assessment.score}%`, backgroundColor: tone }}
        />
      </div>

      <ul className="space-y-2">
        {assessment.factors.map((factor) => (
          <li key={factor.label} className="flex gap-2 text-[12px]">
            <span
              className="mt-0.5 shrink-0"
              style={{ color: factor.ok ?"var(--color-signal)" :"var(--color-alarm)" }}
            >
              {factor.ok ?"✓" :"✕"}
            </span>
            <span>
              <span className="text-[var(--color-ink)]">{factor.label}</span>
              <br />
              <span className="text-[var(--color-dim)]">{factor.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-[var(--color-line)] pt-3 text-[11px] leading-relaxed text-[var(--color-dim)]">
        <p className="tele mb-1">Hidden right now</p>
        <p>
          Which wallet owns {seat ?"your seat" :"any seat"}. Which seat cast which
          ballot. Every seat&apos;s role.
        </p>
        <p className="mt-2 tele mb-1">Public right now</p>
        <p>
          The pot ({match.potAmount}). The stake per seat. The vote tallies. Where everyone
          is standing. Your shielding deposit, which named your address in plaintext.
        </p>
      </div>
    </Panel>
  );
}

/**
 * Re-derives the settlement in the browser and shows whether it matches the chain.
 *
 * Every check recomputes something the contract also computed, from published inputs, using
 * an independent implementation. Agreement is the evidence; the explanation under each row
 * is there because a green tick on its own asks to be trusted, which is the opposite of the
 * point.
 */
export function IntegrityAudit({ match }: { match: MatchView }) {
  const result = useMemo(() => auditMatch(match), [match]);
  const [open, setOpen] = useState<string | null>(null);

  if (!result.applicable) {
    return (
      <Panel weight="rail" title="Verify" className="bg-[var(--color-panel)]/90">
        <p className="text-[12px] text-[var(--color-dim)]">
          Nothing to verify yet. The secrets that make a match checkable are published only
          after play ends - that is what keeps them secret while it matters.
        </p>
      </Panel>
    );
  }

  const allGood = result.failed === 0;
  return (
    <Panel
      title="Verify"
      right={
        <span
          className="text-[11px]"
          style={{ color: allGood ?"var(--color-signal)" :"var(--color-alarm)" }}
        >
          {result.passed}/{result.checks.length} independently checked
        </span>
      }
      className="bg-[var(--color-panel)]/90"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-dim)]">
        Recomputed in this browser from published data, not read back from the server.
      </p>
      <ul className="space-y-1.5">
        {result.checks.map((entry) => (
          <li key={entry.id}>
            <button
              onClick={() => setOpen(open === entry.id ? null : entry.id)}
              className="flex w-full items-start gap-2 text-left text-[12px] hover:text-[var(--color-ink)]"
            >
              <span
                className="mt-0.5 shrink-0"
                style={{ color: entry.ok ?"var(--color-signal)" :"var(--color-alarm)" }}
              >
                {entry.ok ?"✓" :"✕"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[var(--color-ink)]">{entry.label}</span>
                <br />
                <span className="text-[var(--color-dim)]">{entry.recomputed}</span>
              </span>
            </button>
            {open === entry.id && (
              <p className="ml-6 mt-1 border-l border-[var(--color-line)] pl-2 text-[11px] leading-relaxed text-[var(--color-dim)]">
                {entry.because}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * The Detective Pool, explained with this match's actual numbers.
 *
 * The mechanic is the innovation claim, so it earns a panel that shows it paying out rather
 * than a sentence saying it does.
 */
export function DetectiveBreakdown({ match }: { match: MatchView }) {
  const impostors = match.seats.filter((seat) => seat.revealedRole ==="impostor");
  if (match.detectiveWeightTotal === 0 || impostors.length === 0) return null;

  const pot = BigInt(match.potAmount);
  const pool = (pot * BigInt(match.detectiveBps)) / 10000n;

  return (
    <Panel weight="rail" title="Detective Pool" className="bg-[var(--color-panel)]/90">
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-dim)]">
        {pool.toString()} set aside before play - {match.detectiveBps / 100}% of the pot - split
        between everyone who named a real impostor, weighted toward earlier rounds. Paid
        whether or not your side won.
      </p>
      <div className="space-y-1.5 text-[12px]">
        {match.seats
          .filter((seat) => seat.payout && seat.payout !=="0")
          .map((seat) => (
            <div key={seat.index} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {seat.emoji} {seat.persona}
              </span>
              <span className="tabular-nums text-[var(--color-amber)]">{seat.payout}</span>
            </div>
          ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-dim)]">
        Total detective weight across the match: {match.detectiveWeightTotal}
      </p>
    </Panel>
  );
}
