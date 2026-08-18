"use client";

import {
  computeAggregateKey,
  computeRevealToken,
  decryptWithTokens,
  encrypt,
  generateKeyPair,
  randomScalar,
  remask,
  fixedBaseMul,
  toPoint,
  type KeyPair,
  type Point,
} from "@molfi/mental-poker";
import { useState } from "react";

/**
 * A dealt hand, run entirely in this browser with the real cryptography.
 *
 * Every player generates a key, the table encrypts to the aggregate of those keys, each
 * player remasks in turn as a shuffle would, and the card opens only once every player has
 * contributed a reveal token. Nothing here is illustrative: the points are real Grumpkin
 * points and the arithmetic is the same code the tests hold to the threshold property.
 *
 * The honest limit, stated on the page as well as here: the shuffle is not proved. The
 * reference this came from proves it in Noir and verifies on-chain through Garaga, and that
 * layer is not built yet. What this demonstrates is the reveal, not an honest shuffle.
 */

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS = ["♠", "♥", "♦", "♣"];
const cardName = (i: number) => `${RANKS[i % 13]}${SUITS[Math.floor(i / 13) % 4]}`;
const cardPoint = (i: number): Point => toPoint(fixedBaseMul(BigInt(i + 1)));
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

interface Step {
  label: string;
  detail: string;
}

export function Table() {
  const [players, setPlayers] = useState(3);
  const [steps, setSteps] = useState<Step[]>([]);
  const [card, setCard] = useState<number | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [soloAttempt, setSoloAttempt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deal = () => {
    setBusy(true);
    const log: Step[] = [];

    const keys: KeyPair[] = Array.from({ length: players }, () => generateKeyPair());
    log.push({
      label: `${players} players generate a key`,
      detail: "Each secret key stays with its player. Nobody, including the table, sees another's.",
    });

    const aggregate = computeAggregateKey(keys.map((k) => k.publicKey));
    log.push({
      label: "The table computes an aggregate key",
      detail: `x = ${aggregate.x.toString(16).slice(0, 24)}…  No single player holds the matching secret.`,
    });

    const chosen = Math.floor(Math.random() * 52);
    let sealed = encrypt(aggregate, BigInt(chosen + 1), randomScalar());
    log.push({
      label: "A card is encrypted to that key",
      detail: `c2 = ${sealed.c2.x.toString(16).slice(0, 24)}…  Unreadable to everyone at this point.`,
    });

    for (let i = 0; i < players; i += 1) {
      sealed = remask(sealed, randomScalar(), aggregate);
    }
    log.push({
      label: `Each player remasks in turn`,
      detail: "This is what a shuffle does to a card. The ciphertext changes; the card underneath does not.",
    });

    // The claim, tested live: one player acting alone learns nothing.
    const solo = decryptWithTokens(sealed.c2, [computeRevealToken(keys[0].secretKey, sealed.c1)]);
    const soloWorked = samePoint(solo, cardPoint(chosen));
    setSoloAttempt(
      soloWorked
        ? "Player 1 opened it alone. That would be a broken scheme."
        : "Player 1 tried alone and got nothing usable.",
    );

    const tokens = keys.map((k) => computeRevealToken(k.secretKey, sealed.c1));
    const result = decryptWithTokens(sealed.c2, tokens);
    log.push({
      label: "Every player publishes a reveal token",
      detail: "Only now does the card open, and it opens for everyone at once.",
    });

    setSteps(log);
    setCard(chosen);
    setOpened(samePoint(result, cardPoint(chosen)) ? cardName(chosen) : "failed to open");
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="players" className="text-sm text-[var(--text-dim)]">
            Players at the table
          </label>
          <div className="mt-2 flex gap-2">
            {[2, 3, 5, 9].map((n) => (
              <button
                key={n}
                onClick={() => setPlayers(n)}
                aria-pressed={players === n}
                className="fluid rounded-lg border px-3 py-2 text-base font-semibold"
                style={
                  players === n
                    ? { background: "#fff", color: "#000", borderColor: "#fff" }
                    : { borderColor: "var(--line-2)", color: "var(--text)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={deal}
          disabled={busy}
          className="fluid rounded-lg bg-white px-3 py-2 text-base font-semibold text-black hover:bg-[var(--accent)] disabled:opacity-50"
        >
          {busy ? "Dealing" : "Deal a card"}
        </button>
      </div>

      {steps.length > 0 && (
        <>
          <ol className="mt-8 space-y-3">
            {steps.map((s, i) => (
              <li key={s.label} className="rounded-xl bg-[var(--surface-2)] p-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-[var(--accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-base font-semibold">{s.label}</div>
                    <div className="mt-1 break-all font-mono text-xs text-[var(--text-dim)]">
                      {s.detail}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line-2)] p-5">
              <div className="text-sm text-[var(--text-dim)]">One player alone</div>
              <p className="mt-2 text-base">{soloAttempt}</p>
            </div>
            <div className="rounded-xl border border-[var(--accent)] p-5">
              <div className="text-sm text-[var(--text-dim)]">Everyone together</div>
              <p className="mt-2 text-4xl font-semibold">{opened}</p>
              {card !== null && (
                <p className="mt-1 font-mono text-xs text-[var(--text-mute)]">
                  card index {card}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
