/**
 * Funds the on-chain treasury that backs house-agent seats.
 *
 * Agent seats are real stakes: the contract moves `stake_amount` out of the treasury for each
 * one, so the pot a human plays for is genuinely funded rather than notional. This approves
 * the game to pull STRK and then calls `fund_treasury`.
 */

import { config as loadEnv } from "dotenv";
import { Contract } from "starknet";
import { networkFor } from "@crewkill/protocol";
import { makeAccount, makeProvider, settle } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";

const network = process.env.NETWORK ?? "sepolia";
loadEnv({ path: `.env.${network}` });

const ERC20_ABI = [
  {
    type: "function", name: "approve", state_mutability: "external",
    inputs: [{ name: "spender", type: "core::starknet::contract_address::ContractAddress" },
             { name: "amount", type: "core::integer::u256" }],
    outputs: [{ type: "core::bool" }],
  },
  {
    type: "function", name: "balanceOf", state_mutability: "view",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
  },
] as const;

async function main(): Promise<void> {
  const deployment = loadDeployment(network);
  const provider = makeProvider(deployment.rpcUrl);
  const account = makeAccount(provider, process.env.KEEPER_ADDRESS!, process.env.KEEPER_PRIVATE_KEY!);
  const game = new CrewKillContract(deployment.game, provider, account);

  const amount = BigInt(process.env.AMOUNT ?? "30000000000000000000"); // 30 STRK
  void networkFor(network);

  const token = new Contract({ abi: ERC20_ABI as never, address: deployment.stakeToken, providerOrAccount: account });
  console.log(`approving ${Number(amount) / 1e18} STRK to ${deployment.game.slice(0, 14)}…`);
  const approve = await token.invoke("approve", [deployment.stakeToken === "" ? 0 : deployment.game, { low: amount, high: 0n }]);
  await settle(provider, approve);

  console.log("funding treasury…");
  const hash = await game.fundTreasury(amount);
  await settle(provider, { transaction_hash: hash });

  console.log(`treasury now ${await game.treasury()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
