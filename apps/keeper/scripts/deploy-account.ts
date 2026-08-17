/**
 * Publishes the deployer account on-chain, once it has been funded.
 *
 * A Starknet account address is derived from its public key and class, so it can receive
 * funds before it exists. This turns that address into a real contract, which is a
 * precondition for it signing anything.
 */

import { config as loadEnv } from "dotenv";
import { Account, CallData, RpcProvider, ec } from "starknet";
import { STRK_TOKEN, networkFor } from "@crewkill/protocol";

const network = process.env.NETWORK ?? "sepolia";
loadEnv({ path: `.env.${network}` });

async function main(): Promise<void> {
  const net = networkFor(network);
  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL ?? net.rpcUrl });
  const address = process.env.KEEPER_ADDRESS!;
  const privateKey = process.env.KEEPER_PRIVATE_KEY!;
  const classHash = process.env.ACCOUNT_CLASS_HASH!;

  try {
    await provider.getClassHashAt(address);
    console.log(`Account ${address} is already deployed. Nothing to do.`);
    return;
  } catch {
    // Not deployed yet — that is the normal path here.
  }

  const [balance] = await provider.callContract({
    contractAddress: STRK_TOKEN,
    entrypoint: "balanceOf",
    calldata: [address],
  });
  if (BigInt(balance) === 0n) {
    throw new Error(
      `${address} holds no STRK. Fund it first — the account cannot pay for its own deployment.`,
    );
  }
  console.log(`balance ${Number(BigInt(balance)) / 1e18} STRK — deploying…`);

  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const account = new Account({ provider, address, signer: privateKey, cairoVersion: "1" });

  const { transaction_hash, contract_address } = await account.deployAccount(
    {
      classHash,
      constructorCalldata: CallData.compile({ publicKey }),
      addressSalt: publicKey,
      contractAddress: address,
    },
    { tip: 0n },
  );
  console.log(`deploy tx ${transaction_hash}`);
  await provider.waitForTransaction(transaction_hash);
  console.log(`\nAccount live at ${contract_address}`);
  console.log(`Next: NETWORK=${network} pnpm --filter @crewkill/keeper deploy:contracts`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
