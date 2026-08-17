/**
 * End-to-end test of the human path, without a browser.
 *
 * Buys a seat through the pool exactly the way the client does, drives gameplay actions
 * through the keeper's action endpoint, votes on-chain, reveals, and claims — asserting at
 * every step that the chain agrees. Run it against a live keeper:
 *
 *   NETWORK=devnet pnpm --filter @crewkill/keeper exec tsx scripts/human-e2e.ts
 */

import {
  BallotKind,
  MatchPhase,
  actionToken,
  claimCommitment,
  isImpostor,
  killCommitment,
  randomFelt,
  seatCommitment,
  voteReceipt,
  type MatchView,
  adjacencyOf,
  shipMapForSeed,
} from "@crewkill/protocol";
import { config as loadEnv } from "dotenv";
import { makeAccount, makeProvider } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";
import { MockPoolSeat } from "../src/chain/pool.js";

loadEnv();

const API = process.env.API_URL ?? "http://localhost:8080";
const ActionType = { Move: 1, DoTask: 2, Report: 5, UseCams: 9 } as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} → ${response.status} ${text}`);
  return JSON.parse(text) as T;
}

async function rpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return ((await response.json()) as { result: T }).result;
}

async function waitFor(
  matchId: number,
  predicate: (match: MatchView) => boolean,
  what: string,
  timeoutMs = 240_000,
): Promise<MatchView> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const match = await api<MatchView>(`/api/matches/${matchId}`);
    if (predicate(match)) return match;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(1500);
  }
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  ok — ${message}`);
}

async function main(): Promise<void> {
  const network = process.env.NETWORK ?? "devnet";
  const deployment = loadDeployment(network);
  const provider = makeProvider(deployment.rpcUrl);
  const game = new CrewKillContract(deployment.game, provider);

  const accounts = await rpc<Array<{ address: string; private_key: string }>>(
    deployment.rpcUrl,
    "devnet_getPredeployedAccounts",
    {},
  );
  // Take from the back; the keeper leases agent accounts from the front.
  const account = accounts[accounts.length - 2];
  const wallet = new MockPoolSeat(
    "human",
    makeAccount(provider, account.address, account.private_key),
    provider,
    deployment.pool,
    deployment.game,
    deployment.stakeToken,
    deployment.ballot,
  );

  const roleSecret = randomFelt();
  const claimSecret = randomFelt();
  const commitment = seatCommitment(roleSecret, claimCommitment(claimSecret));
  const token = `0x${actionToken(roleSecret, claimSecret).toString(16)}`;

  console.log("waiting for an empty lobby…");
  // `/api/lobby` answers `{lobby: null}` when nothing is open — an ordinary state.
  const openLobby = async (): Promise<MatchView | null> =>
    (await api<{ lobby: MatchView | null }>("/api/lobby")).lobby;

  let lobby = await openLobby();
  while (!lobby || lobby.seatsFilled > 0) {
    await sleep(2000);
    lobby = await openLobby();
  }
  const matchId = lobby.matchId;
  console.log(`joining match ${matchId}`);

  const stake = BigInt(lobby.stakeAmount);
  await wallet.shield(stake);
  await wallet.joinSeat(matchId, commitment, stake);

  const joined = await waitFor(matchId, (m) => m.seatsFilled > 0, "the seat to appear on-chain");
  const seatIndex = await game.getSeatIndexFor(matchId, commitment);
  check(seatIndex !== null, `seat registered on-chain at index ${seatIndex}`);
  check(joined.potAmount === stake.toString(), "the pot took exactly one stake");

  const playing = await waitFor(
    matchId,
    (m) => m.phase === MatchPhase.Playing && m.finalSeed !== null,
    "the roster to lock",
  );
  const impostor = isImpostor(BigInt(playing.finalSeed!), roleSecret, playing.impostorBps);
  check(true, `role resolved locally as ${impostor ? "impostor" : "crew"}`);
  check(
    playing.seats.length === playing.seatCount,
    "every empty seat was filled by a house agent",
  );

  // ── gameplay: walk somewhere and work ──────────────────────────────────────────────
  const night = await waitFor(matchId, (m) => m.roundPhase === "night", "the first night");
  const me = night.seats[seatIndex!];
  // Route on the ship this match is actually being played on.
  const map = shipMapForSeed(BigInt(playing.finalSeed!));
  const destination = adjacencyOf(map)[me.location][0];

  const moveResponse = await fetch(`${API}/api/matches/${matchId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatIndex, token, type: ActionType.Move, destination }),
  });

  if (moveResponse.status === 409) {
    // A legitimate outcome, not a defect: an impostor got to this seat during the night
    // before the action was queued. 409 is exactly the right answer, so assert that and
    // carry on to the parts of the flow a dead seat still has.
    check(!(await api<MatchView>(`/api/matches/${matchId}`)).seats[seatIndex!].alive,
      "409 on a queued action because the seat was eliminated mid-night — correct");
  } else {
    check(moveResponse.ok, `queued action accepted (${moveResponse.status})`);
    const moved = await waitFor(
      matchId,
      (m) => m.seats[seatIndex!].location === destination || !m.seats[seatIndex!].alive,
      "the move to be applied",
      90_000,
    );
    check(
      moved.seats[seatIndex!].location === destination || !moved.seats[seatIndex!].alive,
      "the keeper applied the queued move",
    );
  }

  // Somebody else's token must not drive this seat.
  const stolen = await fetch(`${API}/api/matches/${matchId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seatIndex, token: "0xdead", type: ActionType.Move, destination }),
  });
  check(stolen.status === 403, "a wrong capability token is rejected");

  // ── on-chain: vote, reveal, claim ──────────────────────────────────────────────────
  const voting = await waitFor(matchId, (m) => m.roundPhase === "voting", "the first vote");
  const target = voting.seats.find((seat) => seat.alive && seat.index !== seatIndex)!.index;
  if (voting.seats[seatIndex!].alive) {
    await wallet.castBallot({
      matchId,
      commitment: voteReceipt(roleSecret, voting.round, target),
      kind: BallotKind.Vote,
      round: voting.round,
      targetSeat: target,
    });
    const tallied = await waitFor(
      matchId,
      (m) =>
        (m.tallies.find((t) => t.round === voting.round)?.targets ?? []).some(
          (entry) => entry.seat === target,
        ),
      "the vote to show up in the on-chain tally",
      90_000,
    );
    const votes =
      tallied.tallies
        .find((t) => t.round === voting.round)!
        .targets.find((entry) => entry.seat === target)?.votes ?? 0;
    check(votes >= 1, `ballot counted on-chain (${votes} against seat ${target})`);
  } else {
    console.log("  (seat was eliminated before it could vote — skipping the ballot check)");
  }
  void killCommitment;

  const revealing = await waitFor(
    matchId,
    (m) => m.phase === MatchPhase.Revealing || m.phase === MatchPhase.Settled,
    "the reveal window",
  );
  if (revealing.phase === MatchPhase.Revealing) {
    await api(`/api/reveal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchId,
        roleSecret: `0x${roleSecret.toString(16)}`,
        claimCommitment: `0x${claimCommitment(claimSecret).toString(16)}`,
      }),
    });
  }

  const settled = await waitFor(matchId, (m) => m.phase === MatchPhase.Settled, "settlement");
  const seat = settled.seats[seatIndex!];
  check(seat.revealedRole !== null, `role published on-chain as ${seat.revealedRole}`);
  check(
    seat.revealedRole === (impostor ? "impostor" : "crew"),
    "the chain agrees with the role this client computed locally",
  );

  const owed = BigInt(seat.payout ?? "0");
  if (owed > 0n) {
    const before = await wallet.shieldedBalance(deployment.stakeToken);
    await wallet.claim(matchId, claimSecret);
    const after = await wallet.shieldedBalance(deployment.stakeToken);
    check(after - before === owed, `claimed ${owed} into a shielded note`);
  } else {
    console.log("  (this seat is owed nothing — nothing to claim)");
  }

  console.log("\nHuman path verified end to end.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
