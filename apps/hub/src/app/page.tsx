/**
 * molfi.fun
 *
 * The hub, and deliberately a small one. Its whole job is to say what this place is and send
 * you to a game, so it is a single screen with no navigation to get lost in.
 *
 * It shares CrewKill's tokens and typefaces rather than having a look of its own, because a
 * hub that does not resemble the games on it reads as a different company.
 *
 * Nothing here is invented. Every game listed is one that exists, and a game that is not open
 * yet says so rather than linking somewhere dead.
 */

interface Game {
  slug: string;
  name: string;
  blurb: string;
  /** What the privacy actually buys in this specific game. */
  mechanic: string;
  status: "live" | "soon";
}

const GAMES: Game[] = [
  {
    slug: "crewkill",
    name: "CrewKill",
    blurb:
      "Staked social deduction. Six seats, four rounds, one pot. Some of the crew are impostors and nobody knows who, including the people running it.",
    mechanic:
      "A seat is a commitment, never an address. If seats were addresses you could follow the money and read every role off the settlement.",
    status: "live",
  },
  {
    slug: "poker",
    name: "Poker",
    blurb:
      "Texas Hold'em with no dealer and no server. Cards are shuffled and dealt by the players themselves, and proved correct rather than trusted.",
    mechanic:
      "No single player can read a card. A hand only opens when enough players agree to open it.",
    status: "live",
  },
];

export default function Hub() {
  const live = GAMES.filter((g) => g.status === "live").length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <header>
        <h1 className="macro macro-xl">
          molfi<span className="text-[var(--color-cyan)]">.fun</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed">
          Staked games settled on Starknet, where the privacy is the mechanic rather than a
          feature bolted onto one.
        </p>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--color-dim)]">
          Every game here is unplayable without it. Take the privacy away and the deduction
          game is solvable from the chain, and the card game needs a dealer you have to trust.
        </p>
      </header>

      <section className="mt-12" aria-label="Games">
        <div className="tele">
          {live} game{live === 1 ? "" : "s"} open
        </div>

        <ul className="mt-4 space-y-4">
          {GAMES.map((game) => {
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="macro macro-sm">{game.name}</h2>
                  <span
                    className="tele shrink-0"
                    style={{
                      color:
                        game.status === "live"
                          ? "var(--color-signal)"
                          : "var(--color-dim)",
                    }}
                  >
                    {game.status === "live" ? "open" : "soon"}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed">{game.blurb}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-dim)]">
                  {game.mechanic}
                </p>
                {game.status === "live" && (
                  <div className="tele mt-3 text-[var(--color-cyan)]">
                    {game.slug}.molfi.fun
                  </div>
                )}
              </>
            );

            return (
              <li key={game.slug}>
                {game.status === "live" ? (
                  <a
                    href={`https://${game.slug}.molfi.fun`}
                    className="frame block p-5 no-underline transition-colors hover:bg-[var(--color-line)]/25"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="frame block p-5 opacity-60">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12 border-t border-[var(--color-line)] pt-6">
        <div className="tele">How the privacy works</div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--color-dim)]">
          Stakes are shielded through the STRK20 privacy pool, so a game contract records a
          commitment rather than an address. What a game keeps secret while it runs becomes
          checkable once it ends, because the secrets that make it verifiable are published
          only after they stop mattering.
        </p>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--color-dim)]">
          Deposits and withdrawals are public and name an address. That is a real limit of any
          privacy pool, and each game says so on its own page rather than leaving it out.
        </p>
      </section>

      <footer className="mt-12 border-t border-[var(--color-line)] pt-5">
        <p className="tele">Settled on Starknet</p>
      </footer>
    </main>
  );
}
