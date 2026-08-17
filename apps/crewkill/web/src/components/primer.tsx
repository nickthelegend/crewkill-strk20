"use client";

import { useEffect, useState } from "react";

/**
 * What this is, in the fifteen seconds before someone decides to care.
 *
 * A visitor arrives mid-match and sees a ship, some panels and a countdown. Nothing on
 * screen says that the privacy is the mechanic rather than a feature, which is the entire
 * argument. Someone judging twenty projects will not dig for it.
 *
 * Three cards, no wall of text, and it never appears twice. The last card is the one that
 * matters: a table of what is hidden against what is public, including the parts that are
 * public, because a privacy claim that does not name its own limits is not worth reading.
 */

const SEEN_KEY = "crewkill.primer.v1";

export function Primer() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    // Only ever on a first visit. Someone who dismissed it does not want it back.
    if (localStorage.getItem(SEEN_KEY)) return;
    setStep(0);
  }, []);

  const close = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setStep(null);
  };

  useEffect(() => {
    if (step === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" || event.key === "Enter") {
        setStep((s) => (s === null ? null : s >= 2 ? (close(), null) : s + 1));
      }
      if (event.key === "ArrowLeft") setStep((s) => (s === null || s === 0 ? s : s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (step === null) return null;

  return (
    <div
      className="cutscene fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "color-mix(in srgb, var(--void) 92%, transparent)" }}
      role="dialog"
      aria-modal="true"
      aria-label="What CrewKill is"
    >
      <div className="cutscene-slab frame w-full max-w-2xl p-8">
        {step === 0 && (
          <>
            <div className="tele">A game where the privacy is the point</div>
            <h2 className="macro macro-lg mt-3">Six seats. One pot.</h2>
            <p className="mt-4 text-[14px] leading-relaxed">
              Social deduction, played for real money, settled on-chain. Some of the crew are
              impostors. Nobody knows who, including the people running it.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-dim)]">
              You buy a seat by shielding your stake through the STRK20 privacy pool, so the
              game contract records a commitment and never an address. Your role is drawn from
              a seed committed before the lobby opened, so neither side can steer it.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="tele">Why it needs a privacy pool</div>
            <h2 className="macro macro-lg mt-3">Otherwise you could just read it</h2>
            <p className="mt-4 text-[14px] leading-relaxed">
              If a seat were an address, you could follow the money and deduce every role from
              the settlement. The deduction game would be over before it started.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-dim)]">
              A vote is stored only as a hash of a secret nobody has published. During the
              match it is unlinkable. Once seats reveal to claim payouts, the same hashes
              become checkable by anyone, so a finished match can be audited in full with no
              escrowed key and no trusted party.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="tele">Being straight about it</div>
            <h2 className="macro macro-lg mt-3">What is hidden, what is not</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="tele" style={{ color: "var(--color-signal)" }}>
                  Hidden
                </div>
                <ul className="mt-2 space-y-1 text-[13px]">
                  <li>Which wallet holds which seat</li>
                  <li>Which seat cast which ballot</li>
                  <li>Every role, during play</li>
                </ul>
              </div>
              <div>
                <div className="tele" style={{ color: "var(--color-amber)" }}>
                  Public
                </div>
                <ul className="mt-2 space-y-1 text-[13px]">
                  <li>The pot and the stake</li>
                  <li>Per-round vote counts</li>
                  <li>Where everyone is standing</li>
                  <li>Your shielding deposit, which names you</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-dim)]">
              That last one is real. A deposit is a public transaction, so shield early and
              stake later. The privacy panel scores how well you did it.
            </p>
          </>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1 w-8"
                style={{
                  background: i <= step ? "var(--color-cyan)" : "var(--color-line)",
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={close} className="switch">
              Skip
            </button>
            <button
              onClick={() => (step >= 2 ? close() : setStep(step + 1))}
              className="switch switch-primary"
              autoFocus
            >
              {step >= 2 ? "Watch a match" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reopens the primer on demand.
 *
 * Someone who skipped it on arrival and then wondered what they were looking at should not
 * have to clear storage to find out.
 */
export function PrimerButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(SEEN_KEY);
        window.location.reload();
      }}
      className="switch"
      title="What is this?"
    >
      ?
    </button>
  );
}
