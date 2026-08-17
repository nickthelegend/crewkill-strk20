/**
 * Deploys the CrewKill contracts and writes `deployments/<network>.json`.
 *
 * On devnet this also deploys a mock STRK token and the mock privacy pool, so a whole match
 * can run locally against a real chain. On Sepolia and mainnet the pool and STRK already
 * exist and are verified on-chain before anything is deployed against them.
 *
 *   NETWORK=devnet pnpm --filter @crewkill/keeper deploy:contracts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { networkFor } from "@crewkill/protocol";
import { config as loadEnv } from "dotenv";
import { declareAndDeploy, contractAt, makeAccount, makeProvider, settle } from "../src/chain/client.js";

loadEnv();

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS = join(HERE, "..", "..", "..", "deployments");

export interface DeploymentFile {
  network: string;
  chainId: string;
  rpcUrl: string;
  game: string;
  ballot: string;
  pool: string;
  stakeToken: string;
  owner: string;
  keeper: string;
  /** Every hash this deployment produced, so the README can link to real transactions. */
  transactions: Array<{ kind: string; hash: string }>;
  deployedAt: string;
}

async function main(): Promise<void> {
  const network = networkFor(process.env.NETWORK);
  const rpcUrl = process.env.RPC_URL ?? network.rpcUrl;
  const provider = makeProvider(rpcUrl);

  const ownerAddress = process.env.KEEPER_ADDRESS;
  const ownerKey = process.env.KEEPER_PRIVATE_KEY;
  if (!ownerAddress || !ownerKey) {
    throw new Error(
      "Set KEEPER_ADDRESS and KEEPER_PRIVATE_KEY. On devnet, `pnpm devnet:accounts` prints them.",
    );
  }
  const account = makeAccount(provider, ownerAddress, ownerKey);
  const chainId = await provider.getChainId();
  console.log(`network=${network.name} chainId=${chainId} rpc=${rpcUrl}`);

  const txs: Array<{ kind: string; hash: string }> = [];
  const record = (kind: string, hash: string | null): void => {
    if (hash) txs.push({ kind, hash });
  };

  // ── stake token ────────────────────────────────────────────────────────────────────
  let stakeToken = process.env.STAKE_TOKEN ?? network.stakeToken;
  if (!stakeToken) {
    console.log("deploying mock STRK (devnet only)…");
    const mock = await declareAndDeploy(account, provider, "MockERC20", []);
    stakeToken = mock.address;
    record("declare:MockERC20", mock.declareTx);
    record("deploy:MockERC20", mock.deployTx);
  }
  await assertDeployed(provider, stakeToken, "stake token");

  // ── privacy pool ───────────────────────────────────────────────────────────────────
  let pool = process.env.PRIVACY_POOL ?? network.privacyPool;
  if (!pool) {
    console.log("deploying mock privacy pool (devnet only)…");
    const mock = await declareAndDeploy(account, provider, "MockPrivacyPool", []);
    pool = mock.address;
    record("declare:MockPrivacyPool", mock.declareTx);
    record("deploy:MockPrivacyPool", mock.deployTx);
  }
  await assertDeployed(provider, pool, "privacy pool");

  // ── ballot token ───────────────────────────────────────────────────────────────────
  console.log("deploying CKBALLOT…");
  const ballot = await declareAndDeploy(account, provider, "BallotToken", [ownerAddress]);
  record("declare:BallotToken", ballot.declareTx);
  record("deploy:BallotToken", ballot.deployTx);

  // ── the game ───────────────────────────────────────────────────────────────────────
  console.log("deploying CrewKill…");
  const keeperAddress = process.env.KEEPER_OPERATOR_ADDRESS ?? ownerAddress;
  const game = await declareAndDeploy(account, provider, "CrewKill", [
    ownerAddress,
    keeperAddress,
    pool,
    stakeToken,
    ballot.address,
  ]);
  record("declare:CrewKill", game.declareTx);
  record("deploy:CrewKill", game.deployTx);

  // Only the game may mint ballots — otherwise anyone could vote without staking.
  console.log("handing ballot minting to the game…");
  const ballotContract = contractAt("BallotToken", ballot.address, provider, account);
  const setMinter = await ballotContract.invoke("set_minter", [game.address]);
  record("invoke:set_minter", await settle(provider, setMinter));

  const file: DeploymentFile = {
    network: network.name,
    chainId,
    rpcUrl,
    game: game.address,
    ballot: ballot.address,
    pool,
    stakeToken,
    owner: ownerAddress,
    keeper: keeperAddress,
    transactions: txs,
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(DEPLOYMENTS, { recursive: true });
  const path = join(DEPLOYMENTS, `${network.name}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);

  console.log(`\nwrote ${path}`);
  console.log(`  game   ${game.address}`);
  console.log(`  ballot ${ballot.address}`);
  console.log(`  pool   ${pool}`);
  console.log(`  stake  ${stakeToken}`);
  console.log(`  ${txs.length} transactions`);
}

/**
 * Confirms a contract really exists at an address before we build on top of it.
 *
 * Retries: public RPC endpoints rate-limit, and a transient 429 here would otherwise read as
 * "that contract does not exist", which is a very misleading way to fail.
 */
async function assertDeployed(
  provider: ReturnType<typeof makeProvider>,
  address: string,
  label: string,
): Promise<void> {
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await provider.getClassHashAt(address, "latest");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw new Error(
    `No contract at ${label} address ${address} on this network after 5 attempts: ${lastError.slice(0, 160)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
