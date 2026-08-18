import { Table } from "@/components/table";

/**
 * poker.molfi.fun
 *
 * The page states the one property that makes a dealerless card game possible, then lets you
 * exercise it in your own browser rather than asking you to believe it.
 *
 * It is also explicit about what is not built yet. The shuffle is not proved here, and a page
 * that let you assume otherwise would be the exact dishonesty this whole hub is arguing
 * against.
 */
export default function Poker() {
  return (
    <>
      <nav aria-label="Primary" className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <a href="https://molfi.fun" className="text-base font-semibold tracking-tight no-underline">
            molfi<span className="text-[var(--accent)]">.fun</span>
          </a>
          <div className="flex gap-5 text-sm">
            <a href="https://crewkill.molfi.fun" className="fluid text-[var(--text-dim)] hover:text-white">
              CrewKill
            </a>
            <span className="text-white">Poker</span>
          </div>
        </div>
      </nav>

      <main id="main" className="mx-auto max-w-4xl px-6 pt-16 pb-24">
        <p className="text-sm font-medium text-[var(--text-dim)]">Texas Hold&apos;em</p>

        <h1 className="hero-heading mt-4 max-w-[680px] text-5xl font-semibold tracking-tight sm:text-6xl">
          A card game
          <br />
          with no dealer
        </h1>

        <p className="mt-6 max-w-[680px] text-lg text-[var(--text-dim)]">
          Cards are encrypted to a key no single player holds. A card opens only when every
          player at the table publishes a reveal token, so there is nobody to trust with the
          deck, including whoever runs the table.
        </p>

        <section className="mt-12">
          <h2 className="max-w-[680px] text-3xl font-semibold tracking-tight">
            Deal one and watch it happen
          </h2>
          <p className="mt-4 max-w-[680px] text-lg text-[var(--text-dim)]">
            This runs the real cryptography in your browser. The keys are real Grumpkin keys,
            the ciphertext is real, and the attempt by one player to open the card alone is a
            real attempt that really fails.
          </p>
          <div className="mt-8">
            <Table />
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          <h2 className="max-w-[680px] text-3xl font-semibold tracking-tight">
            What is not built yet
          </h2>
          <p className="mt-4 max-w-[680px] text-lg text-[var(--text-dim)]">
            The reveal is real. The shuffle is not proved.
          </p>
          <p className="mt-4 max-w-[680px] text-base text-[var(--text-dim)]">
            A full mental poker protocol also proves that each player shuffled honestly rather
            than putting the deck in an order they liked. The reference implementation this
            came from does that with Noir circuits verified on-chain through Garaga. That layer
            is not here, so what you just ran demonstrates that a card cannot be read early,
            not that the deck was fair.
          </p>
          <p className="mt-4 max-w-[680px] text-base text-[var(--text-mute)]">
            Saying so is the point. A page claiming a property it has not built is the thing
            this hub exists to argue against.
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <span className="text-sm text-[var(--text-mute)]">poker.molfi.fun</span>
          <a href="https://molfi.fun" className="fluid text-sm text-[var(--text-dim)] hover:text-white">
            Back to molfi.fun
          </a>
        </div>
      </footer>
    </>
  );
}
