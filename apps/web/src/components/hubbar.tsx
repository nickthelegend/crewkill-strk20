"use client";

/**
 * The molfi.fun bar.
 *
 * CrewKill lives at crewkill.molfi.fun, one game on a hub rather than a standalone site.
 * A visitor arriving from a link has no way to know that, and a visitor who wants the other
 * games has no way back, so the relationship needs to be stated in the chrome rather than
 * implied by a domain nobody reads.
 *
 * Deliberately the thinnest thing on the page. It is a wayfinding strip, not a navigation
 * system: the game is the product, and a hub bar that competes with it for attention is
 * worse than none. One line, one rule under it, and it gets out of the way.
 */

interface HubGame {
  slug: string;
  name: string;
  /** Live games link out. The rest say what they are, honestly, rather than pretending. */
  status: "live" | "soon";
}

/**
 * The hub's roster.
 *
 * Anything not yet open is labelled rather than linked, because a dead link in the chrome is
 * worse than an honest "soon".
 */
const GAMES: HubGame[] = [
  { slug: "crewkill", name: "CrewKill", status: "live" },
  { slug: "poker", name: "Poker", status: "live" },
];

export function HubBar({ current = "crewkill" }: { current?: string }) {
  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-hull)]">
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5">
        <a
          href="https://molfi.fun"
          className="group flex items-baseline gap-1.5 no-underline"
          title="molfi.fun"
        >
          <span className="text-[13px] tracking-tight text-[var(--color-ink)]">
            molfi
            <span className="text-[var(--color-cyan)]">.fun</span>
          </span>
        </a>

        <span className="h-3 w-px bg-[var(--color-line)]" aria-hidden />

        <nav className="flex items-center gap-4" aria-label="Games on molfi.fun">
          {GAMES.map((game) => {
            const here = game.slug === current;
            if (game.status !== "live") {
              return (
                <span
                  key={game.slug}
                  className="tele cursor-default"
                  title="Not open yet"
                >
                  {game.name}
                  <span className="ml-1 opacity-60">soon</span>
                </span>
              );
            }
            return (
              <a
                key={game.slug}
                href={`https://${game.slug}.molfi.fun`}
                aria-current={here ? "page" : undefined}
                className="tele no-underline"
                style={here ? { color: "var(--color-ink)" } : undefined}
              >
                {game.name}
              </a>
            );
          })}
        </nav>

        <span className="tele ml-auto hidden sm:inline">
          Staked games, settled on Starknet
        </span>
      </div>
    </div>
  );
}
