/**
 * Client-side copy of the ship's room graph.
 *
 * Duplicated from `apps/keeper/src/game/ship.ts` rather than shared, because the keeper's
 * copy is the one that enforces legality — this one only decides which buttons to draw. If
 * they ever disagree the keeper rejects the move, which is the right way round.
 */

export const ROOM_NAMES: Record<number, string> = {
  0: "Cafeteria",
  1: "Admin",
  2: "Storage",
  3: "Electrical",
  4: "MedBay",
  5: "Upper Engine",
  6: "Lower Engine",
  7: "Security",
  8: "Reactor",
  9: "Weapons",
  10: "Navigation",
  11: "Shields",
  12: "O2",
  13: "Communications",
};

export const ADJACENCY: Record<number, number[]> = {
  0: [1, 4, 5, 9],
  1: [0, 2],
  2: [1, 3, 11, 13],
  3: [2, 6],
  4: [0, 5, 7],
  5: [0, 4, 8],
  6: [2, 3, 7],
  7: [4, 6, 8],
  8: [5, 7],
  9: [0, 10],
  10: [9, 11, 12],
  11: [2, 10],
  12: [10],
  13: [2],
};

export const VENTS: Record<number, number[]> = {
  0: [1],
  1: [0],
  3: [4, 7],
  4: [3, 7],
  5: [8, 6],
  6: [8, 5],
  7: [4, 3],
  8: [5, 6],
};

export const TASK_ROOMS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13];
export const SECURITY = 7;

export enum ActionType {
  Move = 1,
  DoTask = 2,
  Kill = 4,
  Report = 5,
  CallMeeting = 6,
  Vent = 7,
  Sabotage = 8,
  UseCams = 9,
  FixSabotage = 11,
}

export const SABOTAGE_NAMES: Record<number, string> = {
  1: "Lights",
  2: "Reactor meltdown",
  3: "O2 depletion",
  4: "Comms sabotage",
};

export const SABOTAGE_FIX_ROOMS: Record<number, number[]> = {
  1: [3],
  2: [8],
  3: [1, 8],
  4: [1],
};

export function roomName(location: number): string {
  return ROOM_NAMES[location] ?? `Room ${location}`;
}
