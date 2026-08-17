import Link from "next/link";

export const metadata = { title: "Terms — molfi.fun" };

export default function Terms() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <Link href="/" className="fluid text-sm text-[var(--text-dim)] hover:text-white">
        Back to molfi.fun
      </Link>
      <h1 className="hero-heading mt-6 max-w-[680px] text-4xl font-semibold tracking-tight">
        Terms
      </h1>

      <div className="mt-8 max-w-[680px] space-y-6 text-base text-[var(--text-dim)]">
        <section>
          <h2 className="text-lg font-semibold text-white">These are wagered games</h2>
          <p className="mt-2">
            Seats cost value and payouts are real. Games currently run on Sepolia testnet,
            where the funds are test funds and worth nothing. If a game is later offered on
            mainnet, the stake is real and you can lose it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Settlement is by contract</h2>
          <p className="mt-2">
            Roles, votes and payouts are decided by deployed smart contracts, not by us. We
            cannot reverse a result, refund a lost hand, or recover a seat secret you did not
            keep. Contract addresses are published so you can read the rules rather than take
            our word for them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Software as it stands</h2>
          <p className="mt-2">
            This is hackathon software, published with its source and its known limitations
            written down. It is offered without warranty. Do not stake anything you would mind
            losing to a bug.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Where you are</h2>
          <p className="mt-2">
            Rules on wagering differ by country and are your responsibility. If staked games
            are restricted where you live, do not play.
          </p>
        </section>
      </div>
    </main>
  );
}
