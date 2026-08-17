/**
 * The live ship: positions, tasks, sabotage, vents, cameras, bodies, cooldowns, meetings.
 *
 * Ported from the OneChain build's `GameStateManager`. Every rule it enforced — legal moves
 * only along the room graph, vents for impostors only, kill cooldowns, one emergency meeting
 * per seat, sabotage timers, task progress over multiple rounds — is enforced here too.
 *
 * This state is *gameplay*, not money. It decides what a meeting has to argue about; it does
 * not decide who gets paid. Votes, night actions, roles and payouts all live in the Cairo
 * contract, which is why nothing in this file needs to be trusted with anything.
 *
 * Starting positions come from `final_seed`, so even the opening spread is unbiasable by the
 * operator. After that, movement is free — the game is about what people choose to do.
 */

import { hash } from "starknet";
import type { ShipMap } from "@crewkill/protocol";
import {
  EMERGENCY_MEETINGS_PER_SEAT,
  KILL_COOLDOWN_ROUNDS,
  SABOTAGE_COOLDOWN_ROUNDS,
  SABOTAGE_CONFIG,
  SabotageType,
  cameraRooms,
  fixRoomsFor,
  isLegalMove,
  isLegalVent,
  locationName,
  securityRoom,
  taskRooms,
} from "./ship.js";

export interface SeatWorldState {
  index: number;
  location: number;
  alive: boolean;
  inVent: boolean;
  onCameras: boolean;
  /** Rooms this seat has been assigned work in. */
  taskLocations: number[];
  /** Rounds of work banked per room. */
  taskProgress: Map<number, number>;
  tasksCompleted: number;
  emergencyMeetingsUsed: number;
  lastKillRound: number;
  lastSabotageRound: number;
}

export interface DeadBody {
  victim: number;
  location: number;
  round: number;
  reported: boolean;
}

export interface ActiveSabotage {
  type: SabotageType;
  startedRound: number;
  expiresAt: number;
  fixers: Map<number, Set<number>>;
  saboteur: number | null;
}

export interface MoveResult {
  ok: boolean;
  reason?: string;
  /** Seats that watched this happen, either in the room or on cameras. */
  witnesses?: number[];
}

const TASKS_PER_SEAT = 4;
const TASK_ROUNDS_REQUIRED = 2;

export class World {
  readonly seats = new Map<number, SeatWorldState>();
  readonly bodies: DeadBody[] = [];
  sabotage: ActiveSabotage | null = null;
  meetingsCalled = 0;

  constructor(
    private readonly finalSeed: bigint,
    seatCount: number,
    /** The ship this match is on. Every rule below is relative to it. */
    readonly map: ShipMap,
  ) {
    for (let index = 0; index < seatCount; index += 1) {
      this.seats.set(index, {
        index,
        location: this.spawnFor(index),
        alive: true,
        inVent: false,
        onCameras: false,
        taskLocations: this.tasksFor(index),
        taskProgress: new Map(),
        tasksCompleted: 0,
        emergencyMeetingsUsed: 0,
        lastKillRound: -99,
        lastSabotageRound: -99,
      });
    }
  }

  /** Opening position, drawn from the chain so nobody is placed on purpose. */
  private spawnFor(seat: number): number {
    const digest = BigInt(
      hash.computePoseidonHashOnElements([
        this.finalSeed.toString(),
        "0x535041574e",
        seat.toString(),
      ]),
    );
    // Everyone starts somewhere reachable and social: the ship's designated spawn, or one
    // of its work rooms.
    const rooms = taskRooms(this.map);
    return Number(digest % 3n) === 0 || rooms.length === 0
      ? this.map.spawnRoom
      : rooms[Number(digest % BigInt(rooms.length))];
  }

  /** Task assignment, also from the seed, so a crewmate's route is verifiable after the fact. */
  private tasksFor(seat: number): number[] {
    const rooms: number[] = [];
    for (let i = 0; rooms.length < TASKS_PER_SEAT && i < 32; i += 1) {
      const digest = BigInt(
        hash.computePoseidonHashOnElements([
          this.finalSeed.toString(),
          "0x5441534b",
          seat.toString(),
          i.toString(),
        ]),
      );
      const pool = taskRooms(this.map);
      const room = pool[Number(digest % BigInt(pool.length))];
      if (!rooms.includes(room)) rooms.push(room);
    }
    return rooms;
  }

  seat(index: number): SeatWorldState | undefined {
    return this.seats.get(index);
  }

  alive(): SeatWorldState[] {
    return [...this.seats.values()].filter((seat) => seat.alive);
  }

  aliveAt(location: number): SeatWorldState[] {
    return this.alive().filter((seat) => seat.location === location && !seat.inVent);
  }

  /** Seats that can see what happens in `location` right now, cameras included. */
  witnessesAt(location: number, exclude: number[] = []): number[] {
    const inRoom = this.aliveAt(location)
      .map((seat) => seat.index)
      .filter((index) => !exclude.includes(index));
    const watchers =
      SABOTAGE_CONFIG[SabotageType.Comms] && this.sabotage?.type === SabotageType.Comms
        ? [] // Comms down means the cameras are dead too.
        : this.alive()
            .filter((seat) => seat.onCameras && !exclude.includes(seat.index))
            .map((seat) => seat.index);
    const cameraCovers = cameraRooms(this.map).includes(location);
    return [...new Set([...inRoom, ...(cameraCovers ? watchers : [])])];
  }

  // ── movement ──────────────────────────────────────────────────────────────────────

  move(seatIndex: number, destination: number): MoveResult {
    const seat = this.seat(seatIndex);
    if (!seat || !seat.alive) return { ok: false, reason: "seat is not alive" };
    if (seat.inVent) return { ok: false, reason: "still in a vent" };
    if (!isLegalMove(this.map, seat.location, destination)) {
      return { ok: false, reason: `${locationName(this.map, seat.location)} does not connect to ${locationName(this.map, destination)}` };
    }
    seat.location = destination;
    seat.onCameras = false;
    return { ok: true };
  }

  /** Impostors only. Anyone in either room sees it, and that is usually fatal. */
  useVent(seatIndex: number, destination: number, isImpostor: boolean): MoveResult {
    const seat = this.seat(seatIndex);
    if (!seat || !seat.alive) return { ok: false, reason: "seat is not alive" };
    if (!isImpostor) return { ok: false, reason: "crewmates cannot vent" };
    if (!isLegalVent(this.map, seat.location, destination)) {
      return { ok: false, reason: "no vent connects those rooms" };
    }
    const witnesses = [
      ...this.witnessesAt(seat.location, [seatIndex]),
      ...this.witnessesAt(destination, [seatIndex]),
    ];
    seat.location = destination;
    seat.inVent = false;
    seat.onCameras = false;
    return { ok: true, witnesses: [...new Set(witnesses)] };
  }

  // ── tasks ─────────────────────────────────────────────────────────────────────────

  /** Real work. Two rounds in the right room completes one task. */
  doTask(seatIndex: number): { ok: boolean; completed: boolean; reason?: string } {
    const seat = this.seat(seatIndex);
    if (!seat || !seat.alive) return { ok: false, completed: false, reason: "seat is not alive" };
    if (!taskRooms(this.map).includes(seat.location)) {
      return { ok: false, completed: false, reason: "no task here" };
    }
    if (this.sabotage?.type === SabotageType.Comms) {
      return { ok: false, completed: false, reason: "comms are down" };
    }
    const done = (seat.taskProgress.get(seat.location) ?? 0) + 1;
    seat.taskProgress.set(seat.location, done);
    if (done >= TASK_ROUNDS_REQUIRED) {
      seat.taskProgress.set(seat.location, 0);
      seat.tasksCompleted += 1;
      return { ok: true, completed: true };
    }
    return { ok: true, completed: false };
  }

  /** Total crew task progress, as a fraction. The crew's other way to win. */
  taskProgressRatio(crewSeats: number[]): number {
    if (crewSeats.length === 0) return 0;
    let done = 0;
    for (const index of crewSeats) done += this.seat(index)?.tasksCompleted ?? 0;
    return done / (crewSeats.length * TASKS_PER_SEAT);
  }

  // ── kills and bodies ──────────────────────────────────────────────────────────────

  canKill(seatIndex: number, round: number): boolean {
    const seat = this.seat(seatIndex);
    if (!seat || !seat.alive) return false;
    return round - seat.lastKillRound > KILL_COOLDOWN_ROUNDS;
  }

  kill(
    killer: number,
    victim: number,
    round: number,
  ): { ok: boolean; reason?: string; location?: number; witnesses?: number[] } {
    const killerSeat = this.seat(killer);
    const victimSeat = this.seat(victim);
    if (!killerSeat?.alive || !victimSeat?.alive) return { ok: false, reason: "seat is not alive" };
    if (killerSeat.location !== victimSeat.location) {
      return { ok: false, reason: "not in the same room" };
    }
    if (!this.canKill(killer, round)) return { ok: false, reason: "still on cooldown" };

    const witnesses = this.witnessesAt(victimSeat.location, [killer, victim]);
    killerSeat.lastKillRound = round;
    victimSeat.alive = false;
    victimSeat.onCameras = false;
    this.bodies.push({ victim, location: victimSeat.location, round, reported: false });
    return { ok: true, location: victimSeat.location, witnesses };
  }

  unreportedBodyAt(location: number): DeadBody | undefined {
    return this.bodies.find((body) => body.location === location && !body.reported);
  }

  reportBody(seatIndex: number): DeadBody | null {
    const seat = this.seat(seatIndex);
    if (!seat?.alive) return null;
    const body = this.unreportedBodyAt(seat.location);
    if (!body) return null;
    body.reported = true;
    this.meetingsCalled += 1;
    return body;
  }

  // ── meetings ──────────────────────────────────────────────────────────────────────

  callEmergencyMeeting(seatIndex: number): { ok: boolean; reason?: string } {
    const seat = this.seat(seatIndex);
    if (!seat?.alive) return { ok: false, reason: "seat is not alive" };
    if (seat.emergencyMeetingsUsed >= EMERGENCY_MEETINGS_PER_SEAT) {
      return { ok: false, reason: "no emergency meetings left" };
    }
    if (this.sabotage?.type === SabotageType.Comms) {
      return { ok: false, reason: "comms are down" };
    }
    seat.emergencyMeetingsUsed += 1;
    this.meetingsCalled += 1;
    return { ok: true };
  }

  // ── sabotage ──────────────────────────────────────────────────────────────────────

  canSabotage(seatIndex: number, round: number): boolean {
    const seat = this.seat(seatIndex);
    if (!seat?.alive) return false;
    if (this.sabotage) return false;
    return round - seat.lastSabotageRound > SABOTAGE_COOLDOWN_ROUNDS;
  }

  startSabotage(
    seatIndex: number,
    type: SabotageType,
    round: number,
    now: number,
  ): ActiveSabotage | null {
    if (!this.canSabotage(seatIndex, round)) return null;
    const config = SABOTAGE_CONFIG[type];
    if (!config) return null;
    const seat = this.seat(seatIndex)!;
    seat.lastSabotageRound = round;
    this.sabotage = {
      type,
      startedRound: round,
      expiresAt: config.timeLimit > 0 ? now + config.timeLimit * 1000 : 0,
      fixers: new Map(),
      saboteur: seatIndex,
    };
    return this.sabotage;
  }

  /** Returns true once the sabotage is fully repaired. Reactor needs two seats at once. */
  fixSabotage(seatIndex: number): { applied: boolean; fixed: boolean; reason?: string } {
    const seat = this.seat(seatIndex);
    if (!seat?.alive || !this.sabotage) return { applied: false, fixed: false };
    const config = SABOTAGE_CONFIG[this.sabotage.type];
    if (!fixRoomsFor(this.map, this.sabotage.type).includes(seat.location)) {
      return { applied: false, fixed: false, reason: "wrong room" };
    }
    const at = this.sabotage.fixers.get(seat.location) ?? new Set<number>();
    at.add(seatIndex);
    this.sabotage.fixers.set(seat.location, at);

    const fixed = config.requiresMultipleFixes
      ? [...this.sabotage.fixers.values()].some((set) => set.size >= 2)
      : true;
    if (fixed) this.sabotage = null;
    return { applied: true, fixed };
  }

  /** A critical sabotage that runs out of time ends the match for the crew. */
  sabotageExpired(now: number): boolean {
    if (!this.sabotage) return false;
    const config = SABOTAGE_CONFIG[this.sabotage.type];
    return config.isCritical && this.sabotage.expiresAt > 0 && now >= this.sabotage.expiresAt;
  }

  clearSabotage(): void {
    this.sabotage = null;
  }

  // ── cameras and vents ─────────────────────────────────────────────────────────────

  watchCameras(seatIndex: number): { ok: boolean; reason?: string } {
    const seat = this.seat(seatIndex);
    if (!seat?.alive) return { ok: false, reason: "seat is not alive" };
    if (seat.location !== securityRoom(this.map)) {
      return { ok: false, reason: `cameras are in ${locationName(this.map, securityRoom(this.map))}` };
    }
    if (this.sabotage?.type === SabotageType.Comms) {
      return { ok: false, reason: "comms are down" };
    }
    seat.onCameras = true;
    return { ok: true };
  }

  /** Everyone leaves the vents and the cameras when a meeting is called. */
  gatherEveryone(): void {
    for (const seat of this.seats.values()) {
      seat.inVent = false;
      seat.onCameras = false;
      if (seat.alive) seat.location = this.map.spawnRoom;
    }
  }
}

