/**
 * The vocabulary the ported game components speak.
 *
 * `ScrollableMap`, `RoomAssets` and `AmongUsSprite` came across from the OneChain build
 * unchanged — all 3,300 lines of ship art. They expect the shapes below, which are the
 * originals from `legacy-onechain/frontend/src/types/game.ts`, trimmed to what the map
 * actually reads. `apps/web/src/lib/toGameState.ts` adapts live match state into them, so
 * the art never had to learn about seats, commitments or Starknet.
 */

export enum Location {
  Cafeteria = 0,
  Admin = 1,
  Storage = 2,
  Electrical = 3,
  MedBay = 4,
  UpperEngine = 5,
  LowerEngine = 6,
  Security = 7,
  Reactor = 8,
  Weapons = 9,
  Navigation = 10,
  Shields = 11,
  O2 = 12,
  Communications = 13,
}

export const LocationNames: Record<Location, string> = {
  [Location.Cafeteria]: "Cafeteria",
  [Location.Admin]: "Admin",
  [Location.Storage]: "Storage",
  [Location.Electrical]: "Electrical",
  [Location.MedBay]: "MedBay",
  [Location.UpperEngine]: "Upper Engine",
  [Location.LowerEngine]: "Lower Engine",
  [Location.Security]: "Security",
  [Location.Reactor]: "Reactor",
  [Location.Weapons]: "Weapons",
  [Location.Navigation]: "Navigation",
  [Location.Shields]: "Shields",
  [Location.O2]: "O2",
  [Location.Communications]: "Communications",
};

export enum Role {
  None = 0,
  Crewmate = 1,
  Impostor = 2,
}

export const PlayerColors: Record<number, { name: string; hex: string; light: string }> = {
  0: { name: "Red", hex: "#C51111", light: "#FF4D4D" },
  1: { name: "Blue", hex: "#132ED1", light: "#4D6DFF" },
  2: { name: "Green", hex: "#117F2D", light: "#4DFF7F" },
  3: { name: "Pink", hex: "#ED54BA", light: "#FF8DD9" },
  4: { name: "Orange", hex: "#EF7D0D", light: "#FFAB4D" },
  5: { name: "Yellow", hex: "#F5F557", light: "#FFFF8D" },
  6: { name: "Black", hex: "#3F474E", light: "#6B7580" },
  7: { name: "White", hex: "#D6E0F0", light: "#FFFFFF" },
  8: { name: "Purple", hex: "#6B2FBB", light: "#9B5FEB" },
  9: { name: "Brown", hex: "#71491E", light: "#A17B4E" },
  10: { name: "Cyan", hex: "#38FEDC", light: "#7AFFEC" },
  11: { name: "Lime", hex: "#50EF39", light: "#8AFF6D" },
};

/**
 * A player as the map understands one.
 *
 * `address` is a synthetic per-seat identifier here, not a wallet: on Starknet a seat has no
 * address, which is the entire point. It exists because the ported components key on it.
 */
export interface Player {
  address: `0x${string}`;
  name: string;
  colorId: number;
  role: Role;
  location: Location;
  isAlive: boolean;
  tasksCompleted: number;
  totalTasks: number;
  hasVoted: boolean;
  isAIAgent?: boolean;
  agentPersona?: {
    emoji: string;
    title: string;
    playstyle: string;
  };
}

export interface DeadBody {
  victim: `0x${string}`;
  location: Location;
  round: bigint;
  reported: boolean;
}

export enum GamePhase {
  Lobby = 0,
  Starting = 1,
  ActionCommit = 2,
  ActionReveal = 3,
  Discussion = 4,
  Voting = 5,
  Resolution = 6,
  Ended = 7,
}
