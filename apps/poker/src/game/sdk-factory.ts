import { RpcProvider, Account, Signer, AccountInterface } from 'starknet';
import { TexasHoldemSDK } from '@mental-poker/sdk';
import { initWasm } from '../wasm-init';
import { SECRET_KEYS } from '../constants';
import type { DeployedConfig, PlayerContext } from '../types';

/**
 * Create an SDK instance from a local devnet pre-deployed account.
 * Used in local mode where accounts come from deployed-poker.json.
 */
export async function createPlayerContext(
  playerNumber: number,
  deployed: DeployedConfig,
  artifacts: {
    circuits: Record<string, { bytecode: string; abi: unknown }>;
    vks: Record<string, Uint8Array>;
  },
): Promise<PlayerContext> {
  const playerIndex = playerNumber - 1;
  const accountNames = Object.keys(deployed.accounts!);
  const acctInfo = deployed.accounts![accountNames[playerIndex]];

  if (!acctInfo) {
    throw new Error(`No account found for player ${playerNumber} (index ${playerIndex})`);
  }

  if (playerIndex >= SECRET_KEYS.length) {
    throw new Error(`No secret key defined for player ${playerNumber} (max ${SECRET_KEYS.length})`);
  }

  // Initialize WASM before SDK creation
  await initWasm();

  const provider = new RpcProvider({ nodeUrl: deployed.url });
  const account = new Account({
    provider,
    address: acctInfo.address,
    signer: new Signer(acctInfo.private_key),
  });

  const sdk = await TexasHoldemSDK.create(account, deployed.contracts.texas_holdem, {
    threads: 1,
    wasmPath: '/artifacts/barretenberg.wasm.gz',
  });

  // Load circuits and VKs
  for (const [name, artifact] of Object.entries(artifacts.circuits)) {
    await sdk.loadCircuit(name, artifact);
  }
  for (const [name, vk] of Object.entries(artifacts.vks)) {
    sdk.loadVk(name, vk);
  }

  return {
    playerNumber,
    playerIndex,
    sdk,
    account,
    secretKey: SECRET_KEYS[playerIndex],
    address: acctInfo.address,
  };
}

/**
 * Create an SDK instance from a Cartridge Controller account.
 * Used in sepolia mode where the wallet provides the account.
 */
export async function createPlayerContextFromController(
  controllerAccount: AccountInterface,
  deployed: DeployedConfig,
  artifacts: {
    circuits: Record<string, { bytecode: string; abi: unknown }>;
    vks: Record<string, Uint8Array>;
  },
  playerNumber: number,
): Promise<PlayerContext> {
  await initWasm();

  const playerIndex = playerNumber - 1;

  if (playerIndex >= SECRET_KEYS.length) {
    throw new Error(`No secret key defined for player ${playerNumber} (max ${SECRET_KEYS.length})`);
  }

  const sdk = await TexasHoldemSDK.create(
    controllerAccount as any,
    deployed.contracts.texas_holdem,
    { threads: 1, rpcUrl: deployed.url },
  );

  for (const [name, artifact] of Object.entries(artifacts.circuits)) {
    await sdk.loadCircuit(name, artifact);
  }
  for (const [name, vk] of Object.entries(artifacts.vks)) {
    sdk.loadVk(name, vk);
  }

  return {
    playerNumber,
    playerIndex,
    sdk,
    account: controllerAccount as any,
    secretKey: SECRET_KEYS[playerIndex],
    address: controllerAccount.address,
  };
}
