/**
 * Network wiring.
 *
 * Pool and token addresses are protocol facts, not app config, so they live in code and are
 * checked against the chain when the keeper starts, rather than trusted.
 */

export type NetworkName = "devnet" | "sepolia" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  chainId: string;
  rpcUrl: string;
  /** The STRK20 privacy pool. On devnet this is CrewKill's own mock pool. */
  privacyPool: string | null;
  /** Stake token. STRK on the public networks. */
  stakeToken: string | null;
  /** Block explorer base, used for the tx links the demo needs to show. */
  explorer: string;
  /** True when the STRK20 pool is the real one and the SDK route applies. */
  realPool: boolean;
}

/** STRK on Starknet Sepolia and mainnet — same address on both. */
export const STRK_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** STRK20 privacy pool v2.0, Sepolia (strk20-by-example.org/sdk/getting-started). */
export const SEPOLIA_PRIVACY_POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";

/**
 * STRK20 privacy pool, Starknet mainnet. Taken from `@avnu/avnu-sdk`'s
 * `PRIVACY_POOL_ADDRESS` and confirmed live with `starknet_getClassHashAt`
 * (class `0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d`).
 * The keeper re-checks it at boot (`apps/keeper/src/index.ts`) so a stale constant can
 * never send real funds to a contract that is not there.
 */
export const MAINNET_PRIVACY_POOL =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  devnet: {
    name: "devnet",
    chainId: "0x534e5f5345504f4c4941", // SN_SEPOLIA — what starknet-devnet reports by default
    rpcUrl: process.env.DEVNET_RPC ?? "http://127.0.0.1:5050/rpc",
    privacyPool: null, // deployed per-run; written to deployments/devnet.json
    stakeToken: null,
    explorer: "http://127.0.0.1:5050",
    realPool: false,
  },
  sepolia: {
    name: "sepolia",
    chainId: "0x534e5f5345504f4c4941",
    rpcUrl: process.env.SEPOLIA_RPC ?? "https://api.cartridge.gg/x/starknet/sepolia",
    privacyPool: SEPOLIA_PRIVACY_POOL,
    stakeToken: STRK_TOKEN,
    explorer: "https://sepolia.voyager.online",
    realPool: true,
  },
  mainnet: {
    name: "mainnet",
    chainId: "0x534e5f4d41494e", // SN_MAIN
    rpcUrl: process.env.MAINNET_RPC ?? "https://api.cartridge.gg/x/starknet/mainnet",
    privacyPool: MAINNET_PRIVACY_POOL,
    stakeToken: STRK_TOKEN,
    explorer: "https://voyager.online",
    realPool: true,
  },
};

export function networkFor(name: string | undefined): NetworkConfig {
  const key = (name ?? "devnet") as NetworkName;
  const net = NETWORKS[key];
  if (!net) throw new Error(`Unknown network "${name}". Use devnet, sepolia or mainnet.`);
  return net;
}

export interface MatchShape {
  seatCount: number;
  rounds: number;
  impostorBps: number;
  detectiveBps: number;
  protocolBps: number;
}

/** Default match shape. Six seats keeps a demo lobby fillable and a meeting readable. */
export const DEFAULT_MATCH: MatchShape = {
  seatCount: 6,
  rounds: 4,
  /** ~25% of seats draw impostor, so a typical match has one or two — and nobody knows. */
  impostorBps: 2500,
  /** 12% of the pot pays anyone who named a real impostor, win or lose. */
  detectiveBps: 1200,
  protocolBps: 300,
};

/**
 * Off-chain phase clock. Starknet has no timers, so the keeper owns these.
 *
 * Overridable per-phase (`PHASE_LOBBY=15`, `PHASE_VOTING=8`, …) so a demo or an end-to-end
 * test can run a whole match in under a minute without a second code path.
 */
function phaseSeconds(name: string, fallback: number): number {
  const raw = process.env[`PHASE_${name.toUpperCase()}`];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const PHASE_SECONDS = {
  lobby: phaseSeconds("lobby", 90),
  night: phaseSeconds("night", 20),
  meeting: phaseSeconds("meeting", 45),
  voting: phaseSeconds("voting", 30),
  reveal: phaseSeconds("reveal", 60),
} as const;
