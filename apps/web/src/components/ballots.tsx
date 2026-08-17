"use client";

import { NO_TARGET, type MatchView } from"@crewkill/protocol";
import { Crewmate } from"./sprite";
import { colorFor } from"@/lib/skeld";

/**
 * The sealed-ballot moment.
 *
 * A ballot's *count* is public the moment it lands - the contract tallies votes as they are
 * cast, and anyone reading the chain can see the running total. What is sealed is its
 * *authorship*: the receipt is a hash of a secret nobody has published, so nothing on-chain
 * says who cast it.
 *
 * That distinction is the feature, and it is easy to misrepresent. An earlier draft of this
 * panel showed sealed envelopes during voting, which implied the counts were hidden too. They
 * are not, so it does not.
 *
 * The motion is reserved for the honest moment: when a round's tally first arrives, the rows
 * land in sequence rather than appearing all at once - a result being read out, not a table
 * being repainted.
 */

export function BallotBoard({ match }: { match: MatchView }) {
  const tally = match.tallies.find((entry) => entry.round === match.round);

  if (tally) return <RevealedTally match={match} tally={tally} />;

  if (match.tallies.length === 0) {
    return (
      <p className="text-[13px] text-[var(--color-dim)]">
        No ballots spent yet. When they are you will see counts as they land - never who cast
        them.
      </p>
    );
  }
  return <PastRounds match={match} />;
}

/**
 * The tally, with rows landing in sequence the first time a round's result appears.
 *
 * The animation never gates visibility. An earlier version started rows at `opacity-0` and
 * relied on a timer to bring them in, which meant any hiccup in that timer would leave a vote
 * result invisible. A result is information; motion is a flourish on top of it, so the rows
 * render visible and the animation plays over them. `key` on the round makes it replay when a
 * new round lands without any state to get stuck.
 */
function RevealedTally({
  match,
  tally,
}: {
  match: MatchView;
  tally: MatchView["tallies"][number];
}) {
  const rows = tally.targets.slice().sort((a, b) => b.votes - a.votes);
  const most = Math.max(...rows.map((row) => row.votes), 1);
  const total = rows.reduce((sum, row) => sum + row.votes, 0);

  return (
    <div key={tally.round}>
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const seat = row.seat === NO_TARGET ? null : match.seats[row.seat];
          return (
            <div
              key={row.seat}
              className="ballot-flip flex items-center gap-2"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="w-6">
                {seat ? (
                  <Crewmate seatIndex={seat.index} size={18} showName={false} />
                ) : (
                  <span className="text-[11px] text-[var(--color-dim)]">-</span>
                )}
              </span>
              <span className="w-20 shrink-0 truncate text-[12px]">
                {seat ? seat.persona :"skip"}
              </span>
              <span className="h-2 flex-1 overflow-hidden  bg-[var(--color-line)]/40">
                <span
                  className="block h-full  transition-[width] duration-700 ease-out"
                  style={{
                    width: `${(row.votes / most) * 100}%`,
                    backgroundColor: seat ? colorFor(seat.index).hex :"#3f474e",
                  }}
                />
              </span>
              <span className="w-5 shrink-0 text-right tabular-nums text-[11px] text-[var(--color-dim)]">
                {row.votes}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-dim)]">
        {total} ballot{total === 1 ?"" :"s"} counted. Who cast which stays sealed until the
        match ends.
      </p>
    </div>
  );
}

function PastRounds({ match }: { match: MatchView }) {
  const name = (seat: number) =>
    seat === NO_TARGET ?"skip" : (match.seats[seat]?.persona ?? `seat ${seat}`);
  return (
    <div className="space-y-3">
      {match.tallies.map((tally) => (
        <div key={tally.round}>
          <div className="mb-1 tele">
            Round {tally.round}
          </div>
          <div className="space-y-0.5">
            {tally.targets
              .slice()
              .sort((a, b) => b.votes - a.votes)
              .map((target) => (
                <div key={target.seat} className="flex justify-between text-[12px]">
                  <span className="truncate">{name(target.seat)}</span>
                  <span className="tabular-nums text-[var(--color-dim)]">{target.votes}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
