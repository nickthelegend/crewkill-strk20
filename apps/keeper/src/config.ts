import { config as loadEnv } from "dotenv";
import { networkFor, type NetworkConfig } from "@crewkill/protocol";

loadEnv();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export interface KeeperConfig {
  network: NetworkConfig;
  databaseUrl: string;
  port: number;
  /** The account that owns the contracts and pays for keeper transactions. */
  keeperAddress: string;
  keeperPrivateKey: string;
  /**
   * Privacy SDK endpoints. Required only when the keeper has to drive agent seats through
   * the *real* STRK20 pool: proving and note discovery are services, not libraries. On
   * devnet the mock pool needs neither, so both stay unset.
   */
  provingServiceUrl: string | null;
  indexerUrl: string | null;
  /** Agent viewing key for the pool, when running agents against a real pool. */
  agentViewingKey: string | null;
  /** Seconds between indexer polls. */
  pollIntervalMs: number;
  autoMatch: boolean;
}

export function loadConfig(): KeeperConfig {
  const network = networkFor(process.env.NETWORK);
  return {
    network: {
      ...network,
      rpcUrl: process.env.RPC_URL ?? network.rpcUrl,
      privacyPool: process.env.PRIVACY_POOL ?? network.privacyPool,
      stakeToken: process.env.STAKE_TOKEN ?? network.stakeToken,
    },
    databaseUrl: required("DATABASE_URL"),
    port: Number(process.env.PORT ?? 8080),
    keeperAddress: required("KEEPER_ADDRESS"),
    keeperPrivateKey: required("KEEPER_PRIVATE_KEY"),
    provingServiceUrl: process.env.PROVING_SERVICE_URL ?? null,
    indexerUrl: process.env.INDEXER_URL ?? null,
    agentViewingKey: process.env.AGENT_VIEWING_KEY ?? null,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
    autoMatch: process.env.AUTO_MATCH !== "false",
  };
}

/**
 * True when agent seats can be played through the real STRK20 pool. Without a proving
 * service and a discovery indexer the SDK cannot build a private transaction at all, so the
 * keeper says so loudly at boot rather than quietly faking one.
 */
export function canDrivePrivatePool(config: KeeperConfig): boolean {
  return Boolean(
    config.network.realPool && config.provingServiceUrl && config.indexerUrl && config.agentViewingKey,
  );
}
