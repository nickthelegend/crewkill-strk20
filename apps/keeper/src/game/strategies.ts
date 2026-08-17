/**
 * Agent play, ported from the OneChain build's `CrewmateStrategy` and `ImpostorStrategy`.
 *
 * All ten behavioural styles survive intact — the Speedrunner still rushes tasks, the
 * Frame-Game impostor still self-reports and plants blame. Two things changed:
 *
 *   • Seats are indices, not wallet addresses, because on Starknet a seat has no address.
 *   • `Math.random()` is gone. Every roll comes from `poseidon(role_secret, round, salt)`,
 *     so a match replays identically from public data and an agent's "mood" is anchored to
 *     the same secret that decides its role rather than to whatever the server felt like.
 */

import { hash } from "starknet";
import type { CrewmateStyle, ImpostorStyle, Persona } from "@crewkill/protocol";
import { GameMemory } from "./memory.js";
import { stepToward, type ShipMap } from "@crewkill/protocol";
import {
  KILL_COOLDOWN_ROUNDS,
  SABOTAGE_CONFIG,
  SabotageType,
  adjacent,
  fixRoomsFor,
  securityRoom,
  taskRooms,
  ventsFrom,
} from "./ship.js";

/** Impostors hold off until the ship has spread out. */
const MIN_KILL_ROUND = 1;

export enum ActionType {
  None = 0,
  Move = 1,
  DoTask = 2,
  FakeTask = 3,
  Kill = 4,
  Report = 5,
  CallMeeting = 6,
  Vent = 7,
  Sabotage = 8,
  UseCams = 9,
  Skip = 10,
  FixSabotage = 11,
}

export interface AgentAction {
  type: ActionType;
  /** Seat index for `Kill`. */
  target?: number;
  destination?: number;
  sabotage?: SabotageType;
}

export interface SeatSnapshot {
  index: number;
  location: number;
  alive: boolean;
  tasksCompleted: number;
  inVent: boolean;
}

export interface StrategyContext {
  /** The ship being played. Every route and room test below is relative to it. */
  map: ShipMap;
  self: number;
  /** Which action tick of the night this is. Nobody dies on the opening beat. */
  tick: number;
  myLocation: number;
  round: number;
  role: "crew" | "impostor";
  seats: SeatSnapshot[];
  bodies: Array<{ victim: number; location: number; round: number; reported: boolean }>;
  /** Only populated for impostors, and only with impostors the keeper actually knows. */
  knownImpostors: number[];
  taskLocations: number[];
  tasksCompleted: number;
  totalTasks: number;
  activeSabotage: SabotageType;
  meetingsLeft: number;
  sabotageReady: boolean;
  /** Who the meeting is converging on, if anyone. */
  topChatSuspect: number | null;
}

/**
 * Deterministic dice.
 *
 * Seeded from the agent's own role secret, so two agents never roll alike and the same match
 * replays the same way twice. Returns a value in [0, 1).
 */
export function roll(roleSecret: bigint, round: number, salt: string): number {
  const digest = BigInt(
    hash.computePoseidonHashOnElements([
      roleSecret.toString(),
      round.toString(),
      BigInt(`0x${Buffer.from(salt).toString("hex")}`).toString(),
    ]),
  );
  return Number(digest % 10_000n) / 10_000;
}

abstract class BaseStrategy {
  constructor(
    protected readonly roleSecret: bigint,
    protected readonly memory: GameMemory,
  ) {}

  abstract decideAction(context: StrategyContext): AgentAction;
  abstract decideVote(context: StrategyContext): number | null;

  protected chance(context: StrategyContext, salt: string): number {
    return roll(this.roleSecret, context.round, `${salt}:${context.self}`);
  }

  protected pick<T>(context: StrategyContext, salt: string, options: T[]): T {
    return options[Math.floor(this.chance(context, salt) * options.length) % options.length];
  }

  protected seatsAt(context: StrategyContext, location: number): SeatSnapshot[] {
    return context.seats.filter((seat) => seat.alive && seat.location === location);
  }

  protected nextTaskLocation(context: StrategyContext): number | null {
    if (context.taskLocations.length === 0) return null;
    return context.taskLocations[context.tasksCompleted % context.taskLocations.length] ?? null;
  }

  protected wander(context: StrategyContext, preferTasks: boolean): AgentAction {
    const neighbours = adjacent(context.map, context.myLocation);
    if (neighbours.length === 0) return { type: ActionType.Skip };
    const preferred = preferTasks ? neighbours.filter((room) => taskRooms(context.map).includes(room)) : [];
    const options = preferred.length > 0 ? preferred : neighbours;
    return { type: ActionType.Move, destination: this.pick(context, "wander", options) };
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Crew
// ══════════════════════════════════════════════════════════════════════════════════════

export class CrewmateStrategy extends BaseStrategy {
  constructor(
    private readonly style: CrewmateStyle,
    roleSecret: bigint,
    memory: GameMemory,
  ) {
    super(roleSecret, memory);
  }

  decideAction(context: StrategyContext): AgentAction {
    // Universal: a body in the room stops everything.
    const body = context.bodies.find(
      (dead) => dead.location === context.myLocation && !dead.reported,
    );
    if (body) return { type: ActionType.Report };

    // Universal: a live sabotage outranks any personal plan. Critical ones end the game.
    if (context.activeSabotage !== SabotageType.None) {
      const fixRooms = fixRoomsFor(context.map, context.activeSabotage);
      const target = fixRooms[0] ?? context.myLocation;
      if (fixRooms.includes(context.myLocation)) {
        return { type: ActionType.FixSabotage, destination: context.myLocation };
      }
      return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, target) };
    }

    switch (this.style) {
      case "task-focused":
        return this.taskFocused(context);
      case "detective":
        return this.detective(context);
      case "group-safety":
        return this.groupSafety(context);
      case "vigilante":
        return this.vigilante(context);
      case "conservative":
        return this.conservative(context);
      default:
        return this.taskFocused(context);
    }
  }

  /** Speedrunner: heads down, finish the list, win by task completion. */
  private taskFocused(context: StrategyContext): AgentAction {
    const next = this.nextTaskLocation(context);
    if (next !== null && next === context.myLocation) return { type: ActionType.DoTask };
    if (context.tasksCompleted < context.totalTasks && taskRooms(context.map).includes(context.myLocation)) {
      return { type: ActionType.DoTask };
    }
    if (next !== null) {
      const step = stepToward(context.map, context.myLocation, next);
      if (step !== context.myLocation) return { type: ActionType.Move, destination: step };
    }
    return this.wander(context, true);
  }

  /** Investigator: tasks, cameras, and a habit of walking toward whoever smells wrong. */
  private detective(context: StrategyContext): AgentAction {
    for (const seat of context.seats) {
      if (seat.index !== context.self && this.memory.hasDoneNothing(seat.index, 3)) {
        this.memory.addSuspicion(seat.index, 1, 10, context.round, "no task progress at all");
      }
    }

    // Security is the detective's edge: cameras see four rooms at once.
    if (context.myLocation === securityRoom(context.map) && this.chance(context, "cams") > 0.45) {
      return { type: ActionType.UseCams };
    }

    const next = this.nextTaskLocation(context);
    if (next !== null && next === context.myLocation && this.chance(context, "task") > 0.1) {
      return { type: ActionType.DoTask };
    }
    if (
      context.tasksCompleted < context.totalTasks &&
      taskRooms(context.map).includes(context.myLocation) &&
      this.chance(context, "task2") > 0.2
    ) {
      return { type: ActionType.DoTask };
    }
    if (next !== null && next !== context.myLocation) {
      return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, next) };
    }

    const suspect = this.memory.mostSuspicious([context.self]);
    if (suspect) {
      const where = this.memory.lastKnownLocation(suspect.seat);
      if (where !== undefined && where !== context.myLocation) {
        return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, where) };
      }
    }
    return this.wander(context, true);
  }

  /** Bodyguard: never alone, ever. */
  private groupSafety(context: StrategyContext): AgentAction {
    const next = this.nextTaskLocation(context);
    if (next !== null && next === context.myLocation) return { type: ActionType.DoTask };
    if (context.tasksCompleted < context.totalTasks && taskRooms(context.map).includes(context.myLocation)) {
      return { type: ActionType.DoTask };
    }

    const company = this.seatsAt(context, context.myLocation).filter(
      (seat) => seat.index !== context.self,
    );
    if (company.length === 0) {
      const nearest = context.seats.find((seat) => seat.alive && seat.index !== context.self);
      if (nearest) {
        const step = stepToward(context.map, context.myLocation, nearest.location);
        if (step !== context.myLocation) return { type: ActionType.Move, destination: step };
      }
      // Head for the ship's social hub when there is nobody nearby to shelter with.
      if (context.myLocation !== context.map.spawnRoom) {
        return {
          type: ActionType.Move,
          destination: stepToward(context.map, context.myLocation, context.map.spawnRoom),
        };
      }
    }
    if (next !== null && next !== context.myLocation) {
      return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, next) };
    }
    return this.wander(context, true);
  }

  /** Hunter: tasks are a means to an end; the end is calling a meeting on somebody. */
  private vigilante(context: StrategyContext): AgentAction {
    const suspect = this.memory.mostSuspicious([context.self]);
    if (suspect && suspect.score > 55 && context.meetingsLeft > 0) {
      return { type: ActionType.CallMeeting };
    }
    const next = this.nextTaskLocation(context);
    if (next !== null && next === context.myLocation) return { type: ActionType.DoTask };
    if (suspect) {
      const where = this.memory.lastKnownLocation(suspect.seat);
      if (where !== undefined && where !== context.myLocation) {
        return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, where) };
      }
    }
    return this.taskFocused(context);
  }

  /** Analyst: does the work, keeps its mouth shut until the evidence is overwhelming. */
  private conservative(context: StrategyContext): AgentAction {
    const next = this.nextTaskLocation(context);
    if (next !== null && next === context.myLocation) return { type: ActionType.DoTask };
    if (context.tasksCompleted < context.totalTasks && taskRooms(context.map).includes(context.myLocation)) {
      return { type: ActionType.DoTask };
    }
    if (next !== null) {
      return { type: ActionType.Move, destination: stepToward(context.map, context.myLocation, next) };
    }
    return this.wander(context, true);
  }

  decideVote(context: StrategyContext): number | null {
    // Follow the room, most of the time. Bandwagons are real; they should not be total.
    if (context.topChatSuspect !== null && context.topChatSuspect !== context.self) {
      const alive = context.seats.find(
        (seat) => seat.index === context.topChatSuspect && seat.alive,
      );
      if (alive && this.chance(context, "follow") > 0.3) return context.topChatSuspect;
    }

    for (const score of this.memory.ranked([context.self])) {
      const seat = context.seats.find((s) => s.index === score.seat && s.alive);
      if (seat && score.score > 30) return score.seat;
    }

    // A vigilante always names someone. Everyone else would rather skip than be wrong.
    if (this.style === "vigilante") {
      const others = context.seats.filter((seat) => seat.alive && seat.index !== context.self);
      if (others.length > 0) return this.pick(context, "vigilante-vote", others).index;
    }
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Impostors
// ══════════════════════════════════════════════════════════════════════════════════════

export class ImpostorStrategy extends BaseStrategy {
  private lastKillRound = -99;
  private framedTarget: number | null = null;

  constructor(
    private readonly style: ImpostorStyle,
    roleSecret: bigint,
    memory: GameMemory,
  ) {
    super(roleSecret, memory);
  }

  private canKill(context: StrategyContext): boolean {
    if (context.round < MIN_KILL_ROUND) return false;
    // Never on the first beat of the first night. A player who is killed before they have
    // taken a single action has not played a game, they have watched one.
    if (context.round === MIN_KILL_ROUND && context.tick === 0) return false;
    return context.round - this.lastKillRound > KILL_COOLDOWN_ROUNDS;
  }

  /** Somebody in this room worth killing, if the room is quiet enough to risk it. */
  private killTarget(context: StrategyContext): number | null {
    const here = this.seatsAt(context, context.myLocation).filter(
      (seat) => seat.index !== context.self && !context.knownImpostors.includes(seat.index),
    );
    if (here.length === 0) return null;

    const witnesses = this.seatsAt(context, context.myLocation).length - here.length - 1;
    if (witnesses <= 1) return here[0].index;
    if (this.style === "aggressive") return this.pick(context, "target", here).index;
    return null;
  }

  /** Walk toward whoever is standing on their own. */
  private hunt(context: StrategyContext): AgentAction | null {
    const crowd = new Map<number, number>();
    for (const seat of context.seats) {
      if (!seat.alive || seat.index === context.self) continue;
      if (context.knownImpostors.includes(seat.index)) continue;
      crowd.set(seat.location, (crowd.get(seat.location) ?? 0) + 1);
    }
    const lone = [...crowd.entries()].filter(([, count]) => count === 1).map(([room]) => room);
    if (lone.length === 0) return null;
    const target = this.pick(context, "hunt", lone);
    const step = stepToward(context.map, context.myLocation, target);
    return step === context.myLocation ? null : { type: ActionType.Move, destination: step };
  }

  private vent(context: StrategyContext): AgentAction | null {
    const exits = ventsFrom(context.map, context.myLocation);
    if (exits.length === 0) return null;
    return { type: ActionType.Vent, destination: this.pick(context, "vent", exits) };
  }

  decideAction(context: StrategyContext): AgentAction {
    const body = context.bodies.find(
      (dead) => dead.location === context.myLocation && !dead.reported,
    );
    switch (this.style) {
      case "stealth":
        return this.stealth(context, body !== undefined);
      case "aggressive":
        return this.aggressive(context, body !== undefined);
      case "saboteur":
        return this.saboteur(context, body !== undefined);
      case "social-manipulator":
        return this.manipulator(context, body !== undefined);
      case "frame-game":
        return this.frameGame(context, body !== undefined);
      default:
        return this.stealth(context, body !== undefined);
    }
  }

  /** Kills clean, walks away from bodies, fakes tasks to look busy. */
  private stealth(context: StrategyContext, bodyHere: boolean): AgentAction {
    if (bodyHere) return this.wander(context, false);
    if (context.round < MIN_KILL_ROUND) {
      return this.chance(context, "blend") > 0.4
        ? { type: ActionType.FakeTask }
        : this.wander(context, true);
    }
    const target = this.killTarget(context);
    if (target !== null && this.canKill(context)) {
      this.lastKillRound = context.round;
      return { type: ActionType.Kill, target };
    }
    // A vent is the fastest way out of a room you have just emptied.
    if (this.chance(context, "vent-roll") > 0.85) {
      const escape = this.vent(context);
      if (escape) return escape;
    }
    if (this.chance(context, "fake") > 0.4) return { type: ActionType.FakeTask };
    return this.hunt(context) ?? this.wander(context, true);
  }

  /** Kills early, kills often, and will self-report to get ahead of the story. */
  private aggressive(context: StrategyContext, bodyHere: boolean): AgentAction {
    if (bodyHere) {
      if (this.chance(context, "self-report") < 0.3) return { type: ActionType.Report };
      return this.wander(context, false);
    }
    const target = this.killTarget(context);
    if (target !== null && this.canKill(context)) {
      this.lastKillRound = context.round;
      return { type: ActionType.Kill, target };
    }
    return this.hunt(context) ?? this.wander(context, false);
  }

  /** Breaks the ship, then kills in the confusion. */
  private saboteur(context: StrategyContext, bodyHere: boolean): AgentAction {
    if (bodyHere) return this.wander(context, false);
    if (context.sabotageReady && context.activeSabotage === SabotageType.None) {
      const options = [SabotageType.Lights, SabotageType.Reactor, SabotageType.O2, SabotageType.Comms];
      return { type: ActionType.Sabotage, sabotage: this.pick(context, "sabotage", options) };
    }
    const target = this.killTarget(context);
    if (target !== null && this.canKill(context)) {
      this.lastKillRound = context.round;
      return { type: ActionType.Kill, target };
    }
    if (this.chance(context, "vent-roll") > 0.8) {
      const escape = this.vent(context);
      if (escape) return escape;
    }
    return this.hunt(context) ?? this.wander(context, true);
  }

  /** Spends the early game visibly helping people, then eats them. */
  private manipulator(context: StrategyContext, bodyHere: boolean): AgentAction {
    if (bodyHere) return { type: ActionType.Report };
    if (context.round <= 1) {
      const company = this.seatsAt(context, context.myLocation).filter(
        (seat) => seat.index !== context.self,
      );
      if (company.length === 0) {
        const nearest = context.seats.find((seat) => seat.alive && seat.index !== context.self);
        if (nearest) {
          return {
            type: ActionType.Move,
            destination: stepToward(context.map, context.myLocation, nearest.location),
          };
        }
      }
      return { type: ActionType.FakeTask };
    }
    const target = this.killTarget(context);
    if (target !== null && this.canKill(context)) {
      this.lastKillRound = context.round;
      return { type: ActionType.Kill, target };
    }
    return this.chance(context, "blend2") > 0.5
      ? { type: ActionType.FakeTask }
      : (this.hunt(context) ?? this.wander(context, true));
  }

  /** Picks somebody early, kills near them, and reports the body itself. */
  private frameGame(context: StrategyContext, bodyHere: boolean): AgentAction {
    if (this.framedTarget === null) {
      const candidates = context.seats.filter(
        (seat) =>
          seat.alive && seat.index !== context.self && !context.knownImpostors.includes(seat.index),
      );
      if (candidates.length > 0) {
        this.framedTarget = this.pick(context, "frame", candidates).index;
      }
    }
    if (bodyHere) return { type: ActionType.Report };

    // Kill where the mark can be placed at the scene.
    if (this.framedTarget !== null) {
      const mark = context.seats.find((seat) => seat.index === this.framedTarget && seat.alive);
      if (mark && mark.location !== context.myLocation) {
        const target = this.killTarget(context);
        if (target !== null && this.canKill(context)) {
          this.lastKillRound = context.round;
          return { type: ActionType.Kill, target };
        }
        return {
          type: ActionType.Move,
          destination: stepToward(context.map, context.myLocation, mark.location),
        };
      }
    }
    const target = this.killTarget(context);
    if (target !== null && this.canKill(context)) {
      this.lastKillRound = context.round;
      return { type: ActionType.Kill, target };
    }
    return this.chance(context, "fake3") > 0.5
      ? { type: ActionType.FakeTask }
      : this.wander(context, true);
  }

  decideVote(context: StrategyContext): number | null {
    if (this.framedTarget !== null) {
      const mark = context.seats.find((seat) => seat.index === this.framedTarget && seat.alive);
      if (mark) return this.framedTarget;
    }
    // Anyone the room already distrusts is a free ride, as long as they are not a partner.
    if (
      context.topChatSuspect !== null &&
      context.topChatSuspect !== context.self &&
      !context.knownImpostors.includes(context.topChatSuspect)
    ) {
      const alive = context.seats.find(
        (seat) => seat.index === context.topChatSuspect && seat.alive,
      );
      if (alive) return context.topChatSuspect;
    }
    for (const score of this.memory.ranked([context.self])) {
      if (context.knownImpostors.includes(score.seat)) continue;
      const seat = context.seats.find((s) => s.index === score.seat && s.alive);
      if (seat && score.score > 40) return score.seat;
    }
    if (this.style === "aggressive") {
      const others = context.seats.filter(
        (seat) =>
          seat.alive && seat.index !== context.self && !context.knownImpostors.includes(seat.index),
      );
      if (others.length > 0) return this.pick(context, "imp-vote", others).index;
    }
    return null;
  }
}

/** Builds the right strategy for a seat once its role is known to whoever holds the secret. */
export function strategyFor(
  persona: Persona,
  role: "crew" | "impostor",
  roleSecret: bigint,
  memory: GameMemory,
): CrewmateStrategy | ImpostorStrategy {
  return role === "impostor"
    ? new ImpostorStrategy(persona.impostorStyle as ImpostorStyle, roleSecret, memory)
    : new CrewmateStrategy(persona.crewmateStyle as CrewmateStyle, roleSecret, memory);
}
