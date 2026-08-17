/**
 * Ship rules, derived from the map the match is actually being played on.
 *
 * This used to hold a hardcoded fourteen-room graph. That was fine while there was one ship;
 * it becomes a bug the moment there are three, because the client would draw one hull and the
 * keeper would enforce another. The room graph now comes from the shared `ShipMap`, and what
 * stays here is the part that is true of every vessel: cooldowns, sabotage rules, and how a
 * sabotage finds the room that can fix it.
 */

import {
  adjacencyOf,
  roomNameOf,
  roomOf,
  taskRoomsOf,
  ventsOf,
  type FixtureKind,
  type ShipMap,
} from "@crewkill/protocol";

export enum SabotageType {
  None = 0,
  Lights = 1,
  Reactor = 2,
  O2 = 3,
  Comms = 4,
}

export interface SabotageConfig {
  name: string;
  /** A critical sabotage the crew loses to if it is not fixed in time. */
  isCritical: boolean;
  /** Seconds. Zero means it stays broken until somebody fixes it. */
  timeLimit: number;
  /**
   * The fixture that repairs it. Rooms are found by what they contain rather than by id, so
   * the same sabotage works on a ship whose reactor happens to be room 8 and one where it is
   * room 5.
   */
  fixFixture: FixtureKind;
  /** Reactor needs two pairs of hands at once. */
  requiresMultipleFixes: boolean;
}

export const SABOTAGE_CONFIG: Record<number, SabotageConfig> = {
  [SabotageType.Lights]: {
    name: "Lights", isCritical: false, timeLimit: 0,
    fixFixture: "wiring", requiresMultipleFixes: false,
  },
  [SabotageType.Reactor]: {
    name: "Reactor meltdown", isCritical: true, timeLimit: 45,
    fixFixture: "reactor", requiresMultipleFixes: true,
  },
  [SabotageType.O2]: {
    name: "O2 depletion", isCritical: true, timeLimit: 30,
    fixFixture: "oxygen", requiresMultipleFixes: false,
  },
  [SabotageType.Comms]: {
    name: "Comms sabotage", isCritical: false, timeLimit: 0,
    fixFixture: "server", requiresMultipleFixes: false,
  },
};

/** Rounds an impostor must wait between kills. */
export const KILL_COOLDOWN_ROUNDS = 1;
/** Emergency meetings each seat may call, ever. */
export const EMERGENCY_MEETINGS_PER_SEAT = 1;
/** Rounds of work a single task takes. */
export const TASK_ROUNDS_REQUIRED = 2;
/** Rounds between an impostor's sabotages. */
export const SABOTAGE_COOLDOWN_ROUNDS = 2;

export function adjacent(map: ShipMap, location: number): number[] {
  return adjacencyOf(map)[location] ?? [];
}

export function ventsFrom(map: ShipMap, location: number): number[] {
  return ventsOf(map)[location] ?? [];
}

export function isLegalMove(map: ShipMap, from: number, to: number): boolean {
  return from === to || adjacent(map, from).includes(to);
}

export function isLegalVent(map: ShipMap, from: number, to: number): boolean {
  return ventsFrom(map, from).includes(to);
}

export function taskRooms(map: ShipMap): number[] {
  return taskRoomsOf(map);
}

export function locationName(map: ShipMap, location: number): string {
  return roomNameOf(map, location);
}

/** Which rooms can repair a given sabotage on this particular ship. */
export function fixRoomsFor(map: ShipMap, sabotage: SabotageType): number[] {
  const config = SABOTAGE_CONFIG[sabotage];
  if (!config) return [];
  return map.rooms
    .filter((room) => room.fixtures.some((fixture) => fixture.kind === config.fixFixture))
    .map((room) => room.id);
}

/** Rooms a camera watcher can see, and the room they must stand in to watch. */
export function cameraRooms(map: ShipMap): number[] {
  return map.cameraRooms;
}

export function securityRoom(map: ShipMap): number {
  return map.securityRoom;
}

export function hasTasks(map: ShipMap, location: number): boolean {
  return roomOf(map, location)?.hasTasks ?? false;
}
