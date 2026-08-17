/**
 * Proves the Sepolia deployment is a working contract, not just bytecode at an address.
 *
 * Deploying is the easy half. This opens a real match with a real signed transaction, reads
 * the result back from the chain, and then aborts it so nothing is left half-open — every
 * step against the public network, with no mock in the path.
 *
 * House agents cannot play here (they need the real pool's proving service), so this
 * exercises the keeper-signed lifecycle that does not depend on the pool: create, read,
 * abort.
 */

import { config as loadEnv } from "dotenv";
import { seedCommitment } from "@crewkill/protocol";
import { makeAccount, makeProvider, settle } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";

loadEnv({ path: ".env.sepolia" });

const results: Array<{ id: string; ok: boolean; detail: string }> = [];
const record = (id: string, ok: boolean, detail: string) => {
  results.push({ id, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${id.padEnd(28)} ${detail}`);
};

async function main(): Promise<void> {
  const deployment = loadDeployment("sepolia");
  const provider = makeProvider(deployment.rpcUrl);
  const account = makeAccount(provider, process.env.KEEPER_ADDRESS!, process.env.KEEPER_PRIVATE_KEY!);
  const game = new CrewKillContract(deployment.game, provider, account);

  console.log(`\nSepolia verification — ${deployment.game}\n`);

  const chainId = await provider.getChainId();
  record("S1 chain id", chainId === "0x534e5f5345504f4c4941", chainId);

  const classHash = await provider.getClassHashAt(deployment.game, "latest");
  record("S2 contract deployed", classHash.length > 3, `class ${classHash.slice(0, 18)}…`);

  const treasuryBefore = await game.treasury();
  record("S3 treasury funded", treasuryBefore > 0n, `${Number(treasuryBefore) / 1e18} STRK`);

  const countBefore = await game.matchCount();

  // A real signed write against a public network.
  const operatorSeed = BigInt(`0x${Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")}`);
  const created = await game.createMatch({
    seatCount: 4,
    rounds: 3,
    stakeAmount: 100_000_000_000_000_00n, // 0.01 STRK
    impostorBps: 2500,
    detectiveBps: 1200,
    protocolBps: 300,
    seedCommitment: seedCommitment(operatorSeed),
  });
  record("S4 create_match signed", Boolean(created.txHash), `tx ${created.txHash.slice(0, 20)}…`);

  const countAfter = await game.matchCount();
  record("S5 match count advanced", countAfter === countBefore + 1, `${countBefore} → ${countAfter}`);

  const matchId = created.matchId;
  const onchain = await game.getMatch(matchId);
  record(
    "S6 match readable on-chain",
    onchain.seatCount === 4 && onchain.rounds === 3,
    `seats=${onchain.seatCount} rounds=${onchain.rounds} phase=${onchain.phase}`,
  );
  record(
    "S7 stake recorded exactly",
    onchain.stakeAmount === 100_000_000_000_000_00n,
    `${onchain.stakeAmount}`,
  );
  record(
    "S8 seed commitment stored",
    onchain.seedCommitment === seedCommitment(operatorSeed),
    `${onchain.seedCommitment.toString(16).slice(0, 16)}…`,
  );

  // Leave nothing half-open: abort returns any stakes and closes the lobby.
  const abortTx = await game.abortMatch(matchId);
  await settle(provider, { transaction_hash: abortTx });
  const aborted = await game.getMatch(matchId);
  record("S9 abort settled", aborted.phase === 4, `phase=${aborted.phase} tx ${abortTx.slice(0, 18)}…`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSection S: ${results.length - failed.length} passed, ${failed.length} failed\n`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
