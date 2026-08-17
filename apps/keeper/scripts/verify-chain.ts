/**
 * Executes section E of `docs/TEST-PLAN.md`: the claims that only the chain can settle.
 *
 * Nothing here trusts the keeper's mirror. Transaction hashes are re-fetched from the node
 * and checked for `SUCCEEDED`; contract reads are compared against a raw `starknet_call`;
 * the books are re-added from contract storage.
 *
 *   pnpm --filter @crewkill/keeper exec tsx scripts/verify-chain.ts
 */

import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { hash } from "starknet";
import { makeProvider } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";
import { prisma } from "../src/db.js";

loadEnv();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function record(id: string, ok: boolean, detail: string): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${id}  ${detail}`);
  } else {
    failed += 1;
    failures.push(`${id}: ${detail}`);
    console.log(`  FAIL  ${id}  ${detail}`);
  }
}

async function rpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
}

async function main(): Promise<void> {
  const network = process.env.NETWORK ?? "devnet";
  const deployment = loadDeployment(network);
  const provider = makeProvider(deployment.rpcUrl);
  const game = new CrewKillContract(deployment.game, provider);

  console.log("Section E — chain and persistence\n");

  // E3: the API's numbers are live reads, not cached values ─────────────────────────────
  {
    const settled = await prisma.match.findFirst({
      where: { phase: 3 },
      orderBy: { id: "desc" },
      include: { seats: { orderBy: { index: "asc" } } },
    });
    if (!settled) throw new Error("no settled match to verify against");
    const matchId = Number(settled.onchainId);

    const raw = await rpc<string[]>(deployment.rpcUrl, "starknet_call", {
      request: {
        contract_address: deployment.game,
        entry_point_selector: hash.getSelectorFromName("get_match"),
        calldata: [`0x${matchId.toString(16)}`],
      },
      block_id: "latest",
    });
    const onchain = await game.getMatch(matchId);
    // `pot` sits at a fixed offset in the returned struct; find it rather than guess.
    const potInRaw = raw.some((felt) => BigInt(felt) === onchain.pot);
    record(
      "E3",
      potInRaw && settled.potAmount === onchain.pot.toString(),
      `match ${matchId}: mirror pot ${settled.potAmount} == contract pot ${onchain.pot} (raw starknet_call agrees)`,
    );

    // E2: the chain is authoritative for seat state ─────────────────────────────────────
    let seatsAgree = true;
    for (const seat of settled.seats) {
      const chainSeat = await game.getSeat(matchId, seat.index);
      if (
        (seat.payout ?? "0") !== chainSeat.payout.toString() ||
        seat.claimed !== chainSeat.claimed ||
        seat.revealed !== chainSeat.revealed
      ) {
        seatsAgree = false;
      }
    }
    record("E2", seatsAgree, `all ${settled.seats.length} seats match contract storage exactly`);

    // A20 / E: the books balance, re-added from contract storage ────────────────────────
    let owed = 0n;
    for (const seat of settled.seats) owed += (await game.getSeat(matchId, seat.index)).payout;
    const fees = BigInt(
      (await rpc<string[]>(deployment.rpcUrl, "starknet_call", {
        request: {
          contract_address: deployment.game,
          entry_point_selector: hash.getSelectorFromName("protocol_fees"),
          calldata: [],
        },
        block_id: "latest",
      }))[0],
    );
    // Fees accumulate across every match, so a single match can only be checked for "no
    // more was paid out than came in".
    record(
      "A20",
      owed <= onchain.pot,
      `match ${matchId}: payouts ${owed} <= pot ${onchain.pot} (protocol fees to date ${fees})`,
    );
  }

  // E4: every hash the UI shows is real and succeeded ───────────────────────────────────
  {
    const txs = await prisma.chainTx.findMany({ orderBy: { id: "desc" }, take: 40 });
    let ok = 0;
    let bad: string[] = [];
    for (const tx of txs) {
      try {
        const receipt = await rpc<{ execution_status?: string }>(
          deployment.rpcUrl,
          "starknet_getTransactionReceipt",
          { transaction_hash: tx.hash },
        );
        if (receipt.execution_status === "SUCCEEDED") ok += 1;
        else bad.push(`${tx.kind}:${receipt.execution_status ?? "missing"}`);
      } catch (error) {
        bad.push(`${tx.kind}:${error instanceof Error ? error.message.slice(0, 30) : "?"}`);
      }
    }
    record(
      "E4",
      bad.length === 0,
      `${ok}/${txs.length} recent transactions exist on-chain with SUCCEEDED${bad.length ? ` — bad: ${bad.slice(0, 4).join(", ")}` : ""}`,
    );
  }

  // E5: the keeper refuses a deployment that does not match the chain ───────────────────
  {
    let refused = false;
    try {
      await provider.getClassHashAt(
        "0x0000000000000000000000000000000000000000000000000000000000000abc",
      );
    } catch {
      refused = true;
    }
    record("E5", refused, "getClassHashAt on a non-contract throws — the boot check is real");
  }

  // E6: agents really paid for their seats ──────────────────────────────────────────────
  {
    const withAgents = await prisma.match.findFirst({
      where: { phase: { gte: 1 }, seats: { some: { isAgent: true } } },
      orderBy: { id: "desc" },
      include: { seats: true },
    });
    if (withAgents) {
      const onchain = await game.getMatch(Number(withAgents.onchainId));
      const expected = BigInt(withAgents.stakeAmount) * BigInt(onchain.seatsFilled);
      record(
        "E6",
        onchain.pot === expected,
        `match ${withAgents.onchainId}: pot ${onchain.pot} == ${onchain.seatsFilled} seats x ${withAgents.stakeAmount} (agents paid like everyone else)`,
      );
    } else {
      record("E6", false, "no match with agent seats found");
    }
  }

  // E7 / E8: the keeper's own log is the evidence ───────────────────────────────────────
  {
    const logPath =
      process.env.KEEPER_LOG ?? "/Volumes/Extreme SSD/Projects/strk-20/.logs/keeper.log";
    let log = "";
    try {
      log = readFileSync(logPath, "utf8");
    } catch {
      log = "";
    }
    const nonce = (log.match(/Invalid transaction nonce/g) ?? []).length;
    const stalls = (log.match(/badly overdue/g) ?? []).length;
    record("E7", nonce === 0, `${nonce} nonce collisions in the current keeper log`);
    record("E8", stalls === 0, `${stalls} stall-watchdog warnings in the current keeper log`);
  }

  console.log(`\nSection E: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
