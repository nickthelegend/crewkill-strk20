import Link from "next/link";

export const metadata = { title: "Privacy — molfi.fun" };

/**
 * Written as a statement of what the software actually does, because on a site selling
 * privacy a boilerplate policy would undercut the entire pitch.
 */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <Link href="/" className="fluid text-sm text-[var(--text-dim)] hover:text-white">
        Back to molfi.fun
      </Link>
      <h1 className="hero-heading mt-6 max-w-[680px] text-4xl font-semibold tracking-tight">
        Privacy
      </h1>

      <div className="mt-8 max-w-[680px] space-y-6 text-base text-[var(--text-dim)]">
        <p>
          These games run in your browser against public blockchains. What follows describes
          what the software does, not what a template says it might.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-white">What we never receive</h2>
          <p className="mt-2">
            Your seat secrets are generated in your browser and stay there. They are the only
            thing that can compute your role or claim a payout, and no server involved in
            these games ever sees one. If you clear your browser data without a backup, the
            payout is unreachable by us as well as by you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">What is public by design</h2>
          <p className="mt-2">
            Deposits into and withdrawals from the privacy pool are ordinary blockchain
            transactions. They carry your address and the amount, and anyone can read them.
            Pot sizes, stakes and per round vote counts are public while a game runs. Roles
            and ballots become public once a game ends.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">What is stored</h2>
          <p className="mt-2">
            A game server keeps a mirror of public chain state so the interface has something
            fast to read, plus the gameplay positions that are not money. Your browser stores
            your seat secrets and your display preference in local storage. There are no
            analytics, no advertising trackers and no third party scripts on this site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Anonymity has limits</h2>
          <p className="mt-2">
            A privacy pool hides the link between a deposit and a later action. It does not
            hide the deposit. Depositing and playing within moments of each other, or using an
            unusual amount, narrows the set of people you could be. Each game says so where it
            matters rather than only here.
          </p>
        </section>
      </div>
    </main>
  );
}
