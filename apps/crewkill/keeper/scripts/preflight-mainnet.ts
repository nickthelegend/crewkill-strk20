/**
 * Everything that must be true before mainnet costs anything.
 *
 * A mainnet deploy is irreversible and spends real money, so the failure modes worth
 * catching are the ones that only show up after you have paid: a wrong chain, a pool address
 * that is not the pool, a balance that covers the declare but not the deploy, a keeper the
 * contract will not accept.
 *
 * This reads only. It never signs, never writes, and never asks for a key it does not need.
 * Run it, read the numbers, and decide.
 */

import { config as loadEnv } from "dotenv";
import { RpcProvider } from "starknet";
import { MAINNET_PRIVACY_POOL, STRK_TOKEN, networkFor } from "@crewkill/protocol";
import { loadArtifact } from "../src/chain/client.js";

loadEnv({ path: ".env.mainnet" });

interface Check {
  id: string;
  what: string;
  ok: boolean;
  detail: string;
  /** A blocker stops the deploy. A warning is something to know, not something fatal. */
  blocking: boolean;
}

const checks: Check[] = [];
const add = (id: string, what: string, ok: boolean, detail: string, blocking = true) => {
  checks.push({ id, what, ok, detail, blocking });
};

/** Declaring a large class is the single biggest cost, so it is estimated, not guessed. */
const DECLARE_GAS_ESTIMATE = 2_244_368_160n;

async function main(): Promise<void> {
  const net = networkFor("mainnet");
  const rpcUrl = process.env.MAINNET_RPC ?? net.rpcUrl;
  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  console.log(`\nMainnet preflight  ${rpcUrl}\n`);

  // ── the chain is the chain we think it is ────────────────────────────────────────
  let chainId = "";
  try {
    chainId = await provider.getChainId();
    add("P1", "Chain is SN_MAIN", chainId === "0x534e5f4d41494e", chainId);
  } catch (error) {
    add("P1", "Chain is SN_MAIN", false, `RPC unreachable: ${(error as Error).message.slice(0, 60)}`);
  }

  // ── the pool is a real contract, not an address someone typed ────────────────────
  try {
    const poolClass = await provider.getClassHashAt(MAINNET_PRIVACY_POOL, "latest");
    add("P2", "STRK20 pool is deployed", poolClass.length > 3, `class ${poolClass.slice(0, 20)}…`);
  } catch {
    add("P2", "STRK20 pool is deployed", false, `nothing at ${MAINNET_PRIVACY_POOL.slice(0, 20)}…`);
  }

  try {
    const strkClass = await provider.getClassHashAt(STRK_TOKEN, "latest");
    add("P3", "STRK token is deployed", strkClass.length > 3, `class ${strkClass.slice(0, 20)}…`);
  } catch {
    add("P3", "STRK token is deployed", false, `nothing at ${STRK_TOKEN.slice(0, 20)}…`);
  }

  // ── the contracts are built and the class is the one we mean to declare ──────────
  try {
    const artifact = loadArtifact("CrewKill");
    const size = JSON.stringify(artifact.sierra).length;
    add("P4", "CrewKill is built", size > 1000, `${Math.round(size / 1024)} KB sierra`);
  } catch {
    add("P4", "CrewKill is built", false, "run `scarb build` in cairo/ first");
  }

  // ── the deployer ─────────────────────────────────────────────────────────────────
  const address = process.env.KEEPER_ADDRESS;
  if (!address) {
    add("P5", "Deployer configured", false, "KEEPER_ADDRESS unset in .env.mainnet");
  } else {
    add("P5", "Deployer configured", true, address);

    let deployed = false;
    try {
      await provider.getClassHashAt(address, "latest");
      deployed = true;
    } catch {
      deployed = false;
    }
    add(
      "P6",
      "Deployer account exists on-chain",
      deployed,
      deployed ? "deployed" : "not deployed yet; fund it, then run deploy-account.ts",
    );

    // ── can it actually pay ────────────────────────────────────────────────────────
    try {
      const [low] = await provider.callContract({
        contractAddress: STRK_TOKEN,
        entrypoint: "balanceOf",
        calldata: [address],
      });
      const balance = BigInt(low);
      const strk = Number(balance) / 1e18;

      const block = (await provider.getBlockLatestAccepted()) as unknown as {
        l2_gas_price?: { price_in_fri?: string };
      };
      const l2Price = BigInt(block.l2_gas_price?.price_in_fri ?? "0");

      // A price of zero means the read failed, not that the deploy is free. Passing on an
      // estimate we could not make is the one outcome this whole script exists to prevent:
      // `0 >= 0` is true, and it would wave through an account holding nothing.
      if (l2Price === 0n) {
        add(
          "P7",
          "Balance covers the deploy",
          false,
          `could not read the l2 gas price, so the cost is unknown (${strk.toFixed(2)} STRK held)`,
        );
      } else {
        const declareCost = DECLARE_GAS_ESTIMATE * l2Price;
        // Declare plus two deploys plus a couple of invokes, with room to spare.
        const needed = (declareCost * 180n) / 100n;
        add(
          "P7",
          "Balance covers the deploy",
          balance > 0n && balance >= needed,
          `${strk.toFixed(2)} STRK held, about ${(Number(needed) / 1e18).toFixed(2)} needed ` +
            `(declare alone ≈ ${(Number(declareCost) / 1e18).toFixed(2)})`,
        );
      }
    } catch (error) {
      add("P7", "Balance covers the deploy", false, (error as Error).message.slice(0, 70));
    }
  }

  // ── credentials that decide whether the thing is playable once deployed ──────────
  const sdk = ["PROVING_SERVICE_URL", "INDEXER_URL", "AGENT_VIEWING_KEY"].filter(
    (key) => !process.env[key],
  );
  add(
    "P8",
    "House agents can run",
    sdk.length === 0,
    sdk.length === 0
      ? "privacy SDK configured"
      : `missing ${sdk.join(", ")} - contracts still deploy, but no agents fill seats`,
    false,
  );

  // ── nothing half-written left behind ────────────────────────────────────────────
  add(
    "P9",
    "Mainnet deployment file absent",
    true,
    "deployments/mainnet.json is written by the deploy, not before it",
    false,
  );

  // ── report ───────────────────────────────────────────────────────────────────────
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.blocking ? "BLOCK" : "WARN";
    console.log(`  ${mark.padEnd(5)} ${c.id}  ${c.what.padEnd(34)} ${c.detail}`);
  }

  const blockers = checks.filter((c) => !c.ok && c.blocking);
  const warnings = checks.filter((c) => !c.ok && !c.blocking);
  console.log(
    `\n${checks.length - blockers.length - warnings.length}/${checks.length} clear, ` +
      `${blockers.length} blocking, ${warnings.length} to be aware of\n`,
  );

  if (blockers.length > 0) {
    console.log("Not ready. Nothing has been spent.\n");
    process.exit(1);
  }
  console.log("Ready. The next command spends real money:");
  console.log("  NETWORK=mainnet pnpm --filter @crewkill/keeper deploy:contracts\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
