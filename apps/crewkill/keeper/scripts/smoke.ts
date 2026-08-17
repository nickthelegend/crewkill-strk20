/**
 * Smoke test for the chain layer: one four-seat match, played to settlement with real
 * signed transactions against whatever network `NETWORK` points at.
 *
 * This deliberately bypasses the game engine and the database — it exists to prove the
 * contract plumbing (calldata shapes, enum encoding, the pool sandwich) before anything is
 * built on top of it.
 */

import {
  BallotKind,
  claimCommitment,
  finalSeed,
  isImpostor,
  killCommitment,
  randomFelt,
  seatCommitment,
  seedCommitment,
  voteReceipt,
} from "@crewkill/protocol";
import { config as loadEnv } from "dotenv";
import { makeAccount, makeProvider } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";
import { MockPoolSeat } from "../src/chain/pool.js";

loadEnv();

const STAKE = 1_000_000n;

async function devnetAccounts(rpcUrl: string): Promise<Array<{ address: string; private_key: string }>> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "devnet_getPredeployedAccounts",
      params: {},
    }),
  });
  const body = (await response.json()) as { result: Array<{ address: string; private_key: string }> };
  return body.result;
}

async function main(): Promise<void> {
  const network = process.env.NETWORK ?? "devnet";
  const deployment = loadDeployment(network);
  const provider = makeProvider(deployment.rpcUrl);
  const keeper = makeAccount(
    provider,
    process.env.KEEPER_ADDRESS!,
    process.env.KEEPER_PRIVATE_KEY!,
  );
  const game = new CrewKillContract(deployment.game, provider, keeper);

  const accounts = await devnetAccounts(deployment.rpcUrl);
  const players = accounts.slice(1, 5).map((a, i) => {
    const account = makeAccount(provider, a.address, a.private_key);
    return {
      name: `p${i}`,
      wallet: new MockPoolSeat(
        `p${i}`,
        account,
        provider,
        deployment.pool,
        deployment.game,
        deployment.stakeToken,
        deployment.ballot,
      ),
      roleSecret: randomFelt(),
      claimSecret: randomFelt(),
    };
  });

  console.log("shielding stakes…");
  for (const p of players) await p.wallet.shield(STAKE);

  const operatorSeed = randomFelt();
  const { matchId, txHash } = await game.createMatch({
    stakeAmount: STAKE,
    seatCount: 4,
    rounds: 3,
    impostorBps: 2500,
    detectiveBps: 1200,
    protocolBps: 300,
    seedCommitment: seedCommitment(operatorSeed),
  });
  console.log(`match ${matchId} created in ${txHash}`);

  const commitments: bigint[] = [];
  for (const p of players) {
    const commitment = seatCommitment(p.roleSecret, claimCommitment(p.claimSecret));
    commitments.push(commitment);
    const hash = await p.wallet.joinSeat(matchId, commitment, STAKE);
    console.log(`${p.name} bought a seat in ${hash}`);
  }

  const startTx = await game.startMatch(matchId, operatorSeed);
  const onchain = await game.getMatch(matchId);
  console.log(`match started in ${startTx}, final_seed=0x${onchain.finalSeed.toString(16)}`);

  if (finalSeed(operatorSeed, commitments) !== onchain.finalSeed) {
    throw new Error("final_seed derived off-chain does not match the contract");
  }

  const roles = players.map((p) =>
    isImpostor(onchain.finalSeed, p.roleSecret, onchain.impostorBps),
  );
  console.log(
    "roles:",
    roles.map((r, i) => `${players[i].name}=${r ? "impostor" : "crew"}`).join(" "),
  );

  const impostorIdx = roles.findIndex(Boolean);
  if (impostorIdx >= 0) {
    const victim = roles.findIndex((r) => !r);
    await players[impostorIdx].wallet.castBallot({
      matchId,
      commitment: killCommitment(players[impostorIdx].roleSecret, 1, victim),
      kind: BallotKind.Kill,
      round: 1,
      targetSeat: victim,
    });
    console.log(`seat ${impostorIdx} eliminated seat ${victim} at night`);
  }

  const target = impostorIdx >= 0 ? impostorIdx : 0;
  for (let i = 0; i < players.length; i += 1) {
    if (i === target) continue;
    await players[i].wallet.castBallot({
      matchId,
      commitment: voteReceipt(players[i].roleSecret, 1, target),
      kind: BallotKind.Vote,
      round: 1,
      targetSeat: target,
    });
  }
  console.log(`tally r1 vs seat ${target}: ${await game.getTally(matchId, 1, target)}`);

  await game.endPlay(matchId, 1);
  for (const p of players) {
    await game.revealSeat(matchId, p.roleSecret, claimCommitment(p.claimSecret));
  }
  const settleTx = await game.settleMatch(matchId);
  const settled = await game.getMatch(matchId);
  console.log(
    `settled in ${settleTx}: crewWon=${settled.crewWon} impostors=${settled.impostorCount} pot=${settled.pot}`,
  );

  let paidOut = 0n;
  for (let i = 0; i < players.length; i += 1) {
    const seat = await game.getSeat(matchId, i);
    console.log(`  seat ${i} payout=${seat.payout} impostor=${seat.isImpostor}`);
    if (seat.payout > 0n) {
      const before = await players[i].wallet.shieldedBalance(deployment.stakeToken);
      await players[i].wallet.claim(matchId, players[i].claimSecret);
      const after = await players[i].wallet.shieldedBalance(deployment.stakeToken);
      if (after - before !== seat.payout) {
        throw new Error(`seat ${i} received ${after - before}, expected ${seat.payout}`);
      }
      paidOut += seat.payout;
    }
  }
  console.log(`\nOK — ${paidOut} paid out of a ${settled.pot} pot, all balances verified.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
