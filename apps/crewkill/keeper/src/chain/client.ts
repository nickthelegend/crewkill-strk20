/**
 * Everything that touches Starknet.
 *
 * There is no simulation layer here and no cached "balance" the server made up: every read
 * is an RPC call against a real node and every write is a signed transaction whose hash is
 * stored and surfaced in the UI.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Account,
  CallData,
  Contract,
  RpcProvider,
  type Abi,
  type BigNumberish,
  type InvokeFunctionResponse,
} from "starknet";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `cairo/target/dev` — the artefacts scarb just built, not a checked-in copy. */
export const ARTIFACT_DIR = join(HERE, "..", "..", "..", "..", "..", "cairo", "target", "dev");

export interface Artifact {
  sierra: Record<string, unknown>;
  casm: Record<string, unknown>;
  abi: Abi;
}

export function loadArtifact(contractName: string): Artifact {
  const base = join(ARTIFACT_DIR, `crewkill_${contractName}`);
  const sierra = JSON.parse(readFileSync(`${base}.contract_class.json`, "utf8"));
  const casm = JSON.parse(readFileSync(`${base}.compiled_contract_class.json`, "utf8"));
  return { sierra, casm, abi: sierra.abi as Abi };
}

export function makeProvider(rpcUrl: string): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl });
}

export function makeAccount(
  provider: RpcProvider,
  address: string,
  privateKey: string,
): Account {
  // cairoVersion "1" is required for accounts sending v3 transactions.
  return new Account({ provider, address, signer: privateKey, cairoVersion: "1" });
}

/**
 * Declares a class if the chain does not have it yet, then deploys it.
 *
 * Fees are estimated and bounded explicitly rather than left to the library's defaults. On a
 * public network the default multipliers turned a large contract's declare into a six-figure
 * l2-gas request — a bound so far above the real cost that validation rejected it as
 * exceeding the account balance. Estimating once and adding a deliberate margin keeps the
 * bound honest and the failure mode legible.
 *
 * `declareIfNot` makes this idempotent: re-running after a partial deployment does not pay to
 * declare a class the chain already has.
 */
export async function declareAndDeploy(
  account: Account,
  provider: RpcProvider,
  contractName: string,
  constructorArgs: BigNumberish[],
): Promise<{ address: string; declareTx: string | null; deployTx: string }> {
  const artifact = loadArtifact(contractName);

  // Estimate first and set the bounds ourselves. Left to its defaults the library asks for
  // billions of l2 gas units, which validation rejects as exceeding the account balance long
  // before anything is actually spent.
  const payload = { contract: artifact.sierra as never, casm: artifact.casm as never };
  let declareOptions: Record<string, unknown> = { tip: 0n };
  try {
    const estimate = await account.estimateDeclareFee(payload);
    // Use the estimate's gas *amounts* but price them at the live block rate rather than the
    // estimate's padded rate. Declaring a large class is close enough to the account balance
    // that the padding alone decides whether validation accepts the transaction, and the
    // amount — not the price — is what the node actually meters.
    const bounds = widen(estimate.resourceBounds);
    declareOptions = { tip: 0n, resourceBounds: bounds };
    const worst =
      BigInt(bounds.l2_gas.max_amount) * BigInt(bounds.l2_gas.max_price_per_unit) +
      BigInt(bounds.l1_data_gas.max_amount) * BigInt(bounds.l1_data_gas.max_price_per_unit);
    console.log(
      `  ${contractName}: estimated ~${fmtStrk(estimate.overall_fee)} STRK, bounded at ~${fmtStrk(worst)} STRK`,
    );
  } catch {
    // Already declared, or the node declines to estimate — fall through and let the call
    // decide, since declareIfNot will simply skip a class the chain already has.
  }

  const declared = await account.declareIfNot(payload, declareOptions);
  if (declared.transaction_hash) {
    await settle(provider, { transaction_hash: declared.transaction_hash });
  }

  const deployed = await account.deployContract(
    { classHash: declared.class_hash, constructorCalldata: constructorArgs },
    { tip: 0n },
  );
  await settle(provider, { transaction_hash: deployed.transaction_hash });

  return {
    address: deployed.contract_address,
    declareTx: declared.transaction_hash || null,
    deployTx: deployed.transaction_hash,
  };
}

/**
 * Adds a deliberate margin to an estimate: enough that a small price move between estimate
 * and inclusion does not fail the transaction, small enough that the bound still means
 * something.
 */
type Bound = { max_amount: bigint | string; max_price_per_unit: bigint | string };

/** Re-prices an estimate's gas amounts at the current block's rates, plus a small margin. */
async function priceAtBlock(
  provider: RpcProvider,
  bounds: { l1_gas: Bound; l2_gas: Bound; l1_data_gas: Bound },
) {
  const block = (await provider.getBlockLatestAccepted()) as unknown as {
    l1_gas_price?: { price_in_fri?: string };
    l2_gas_price?: { price_in_fri?: string };
    l1_data_gas_price?: { price_in_fri?: string };
  };
  const margin = (value: bigint): bigint => (value * 105n) / 100n;
  const priceOf = (live: string | undefined, fallback: bigint | string): bigint =>
    live ? margin(BigInt(live)) : BigInt(fallback);

  return {
    l1_gas: {
      max_amount: margin(BigInt(bounds.l1_gas.max_amount)),
      max_price_per_unit: priceOf(
        block.l1_gas_price?.price_in_fri,
        bounds.l1_gas.max_price_per_unit,
      ),
    },
    l2_gas: {
      max_amount: margin(BigInt(bounds.l2_gas.max_amount)),
      max_price_per_unit: priceOf(
        block.l2_gas_price?.price_in_fri,
        bounds.l2_gas.max_price_per_unit,
      ),
    },
    l1_data_gas: {
      max_amount: margin(BigInt(bounds.l1_data_gas.max_amount)),
      max_price_per_unit: priceOf(
        block.l1_data_gas_price?.price_in_fri,
        bounds.l1_data_gas.max_price_per_unit,
      ),
    },
  };
}

function widen(bounds: { l1_gas: Bound; l2_gas: Bound; l1_data_gas: Bound }) {
  // 15% over the estimate. The estimate already carries the node's own margin, and a large
  // declare is close enough to the account balance that a second 50% multiplier on top is
  // the difference between "fits" and "validation rejects it".
  const scale = (value: bigint | string): bigint => (BigInt(value) * 115n) / 100n;
  const widenOne = (b: Bound) => ({
    max_amount: scale(b.max_amount),
    max_price_per_unit: scale(b.max_price_per_unit),
  });
  return {
    l1_gas: widenOne(bounds.l1_gas),
    l2_gas: widenOne(bounds.l2_gas),
    l1_data_gas: widenOne(bounds.l1_data_gas),
  };
}

function fmtStrk(wei: bigint | string): string {
  return (Number(BigInt(wei)) / 1e18).toFixed(4);
}

export function contractAt(
  contractName: string,
  address: string,
  provider: RpcProvider,
  account?: Account,
): Contract {
  const { abi } = loadArtifact(contractName);
  const contract = new Contract({ abi, address, providerOrAccount: account ?? provider });
  return contract;
}

/** Waits for a transaction and throws on revert, so a failed write never looks like a success. */
export async function settle(
  provider: RpcProvider,
  tx: InvokeFunctionResponse | { transaction_hash: string },
): Promise<string> {
  const hash = tx.transaction_hash;
  // Devnet mints a block per transaction, so the default multi-second poll is pure latency.
  // The timeout matters more than the interval: an unbounded wait on a transaction that
  // never lands stalls the keeper's clock with no error to point at.
  const receipt = await withTimeout(
    provider.waitForTransaction(hash, { retryInterval: 400 }),
    60_000,
    `waiting for ${hash}`,
  );
  const value = receipt as unknown as {
    execution_status?: string;
    revert_reason?: string;
  };
  if (value.execution_status === "REVERTED") {
    throw new Error(`Transaction ${hash} reverted: ${value.revert_reason ?? "unknown"}`);
  }
  // Treat an absent status as a failure rather than a success.
  //
  // Not every RPC returns `execution_status` on every receipt shape. Reading "no REVERTED
  // field" as "it worked" is how a reverted write gets recorded as a landed one: the keeper
  // moves on, the mirror says the phase changed, and the chain disagrees. Silence is not
  // consent — if we cannot see that it succeeded, we did not see it succeed.
  if (value.execution_status !== "SUCCEEDED") {
    throw new Error(
      `Transaction ${hash} did not report success (execution_status=` +
        `${value.execution_status ?? "absent"}). Refusing to treat it as landed.`,
    );
  }
  return hash;
}

/** Rejects rather than hanging forever. */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms ${what}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { CallData };
