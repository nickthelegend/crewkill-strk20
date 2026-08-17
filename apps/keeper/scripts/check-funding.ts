/**
 * Reads the deployer's STRK balance on the target network. Used to poll before deploying the
 * account, since the address is fundable before it exists on-chain.
 */
import { config as loadEnv } from "dotenv";
import { RpcProvider, hash } from "starknet";
import { STRK_TOKEN, networkFor } from "@crewkill/protocol";

loadEnv({ path: `.env.${process.env.NETWORK ?? "sepolia"}` });

const net = networkFor(process.env.NETWORK ?? "sepolia");
const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL ?? net.rpcUrl });
const address = process.env.KEEPER_ADDRESS!;

const [low] = await provider.callContract({
  contractAddress: STRK_TOKEN,
  entrypoint: "balanceOf",
  calldata: [address],
});
const balance = BigInt(low);
const strk = Number(balance) / 1e18;

let deployed = false;
try {
  await provider.getClassHashAt(address);
  deployed = true;
} catch {
  deployed = false;
}

console.log(`address   ${address}`);
console.log(`balance   ${strk.toFixed(4)} STRK  (${balance} wei)`);
console.log(`deployed  ${deployed ? "yes" : "no — run deploy-account.ts once funded"}`);
void hash;
