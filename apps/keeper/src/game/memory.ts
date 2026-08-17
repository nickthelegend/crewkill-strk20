/**
 * What an agent remembers.
 *
 * Ported from the OneChain build's `GameMemory`, re-keyed from wallet addresses to seat
 * indices. Each agent keeps its own copy — two agents that saw different rooms genuinely
 * believe different things, which is what makes a meeting an argument rather than a chorus.
 */

import type { ShipMap } from "@crewkill/protocol";
import { locationName } from "./ship.js";

export enum AccuseReason {
  NearBody = 0,
  NoTasks = 1,
  SuspiciousMovement = 2,
  SawVent = 3,
  Inconsistent = 4,
  Following = 5,
  SelfReport = 6,
}

export interface SuspicionReason {
  type: AccuseReason;
  weight: number;
  round: number;
  details?: string;
}

export interface SuspicionScore {
  seat: number;
  score: number;
  reasons: SuspicionReason[];
}

interface SeatBehaviour {
  seat: number;
  movementPattern: number[];
  tasksCompleted: number;
  timesAccused: number;
  votingAccuracy: number;
  wasWithVictimCount: number;
  reportedBodies: number;
  calledMeetings: number;
}

export class GameMemory {
  /** The ship, so recollections can name rooms the way the player saw them. */
  constructor(private readonly map: ShipMap) {}

  private readonly movements: Array<{ seat: number; from: number; to: number; round: number }> = [];
  private readonly kills: Array<{
    victim: number;
    location: number;
    round: number;
    possibleKillers: number[];
  }> = [];
  private readonly voteHistory: Array<{
    round: number;
    votes: Map<number, number | null>;
    ejected: number | null;
    wasImpostor: boolean | null;
  }> = [];
  private readonly behaviours = new Map<number, SeatBehaviour>();
  private readonly suspicion = new Map<number, SuspicionScore>();
  private readonly knownLocations = new Map<number, number>();
  private round = 0;

  // ── recording ─────────────────────────────────────────────────────────────────────

  recordMovement(seat: number, from: number, to: number, round: number): void {
    this.movements.push({ seat, from, to, round });
    this.knownLocations.set(seat, to);
    this.behaviour(seat).movementPattern.push(to);
  }

  /** The heaviest signal in the game: you were in the room when the lights went out. */
  recordKill(victim: number, location: number, round: number, present: number[]): void {
    this.kills.push({
      victim,
      location,
      round,
      possibleKillers: present.filter((seat) => seat !== victim),
    });
    for (const seat of present) {
      if (seat === victim) continue;
      this.behaviour(seat).wasWithVictimCount += 1;
      this.addSuspicion(
        seat,
        AccuseReason.NearBody,
        30,
        round,
        `in ${locationName(this.map, location)} when it happened`,
      );
    }
  }

  /** Nothing is as damning as being caught coming out of a vent. */
  recordVentSighting(seat: number, location: number, round: number): void {
    this.addSuspicion(
      seat,
      AccuseReason.SawVent,
      55,
      round,
      `seen venting in ${locationName(this.map, location)}`,
    );
  }

  recordVote(
    round: number,
    votes: Map<number, number | null>,
    ejected: number | null,
    wasImpostor: boolean | null,
  ): void {
    this.voteHistory.push({ round, votes, ejected, wasImpostor });
    if (ejected === null || wasImpostor === null) return;

    // Hindsight: whoever backed a correct ejection earns trust, and whoever pushed an
    // innocent out looks worse for it.
    for (const [voter, target] of votes) {
      if (target !== ejected) continue;
      const behaviour = this.behaviour(voter);
      behaviour.votingAccuracy = wasImpostor
        ? (behaviour.votingAccuracy + 1) / 2
        : (behaviour.votingAccuracy - 0.5) / 2;
      if (wasImpostor) {
        this.adjustSuspicion(voter, -20);
      } else {
        this.addSuspicion(voter, AccuseReason.Inconsistent, 25, round, "pushed an innocent out");
      }
    }
  }

  /** Self-reporting is a classic impostor move, so it costs a little trust either way. */
  recordReport(reporter: number, round: number): void {
    this.behaviour(reporter).reportedBodies += 1;
    this.addSuspicion(reporter, AccuseReason.SelfReport, 10, round, "reported the body");
  }

  recordTaskCompletion(seat: number): void {
    this.behaviour(seat).tasksCompleted += 1;
    this.adjustSuspicion(seat, -10);
  }

  recordMeeting(seat: number): void {
    this.behaviour(seat).calledMeetings += 1;
  }

  setRound(round: number): void {
    this.round = round;
  }

  // ── suspicion ─────────────────────────────────────────────────────────────────────

  addSuspicion(
    seat: number,
    type: AccuseReason,
    weight: number,
    round: number,
    details?: string,
  ): void {
    const score = this.suspicion.get(seat) ?? { seat, score: 0, reasons: [] };
    score.reasons.push({ type, weight, round, details });
    score.score = Math.min(100, score.score + weight);
    this.suspicion.set(seat, score);
  }

  adjustSuspicion(seat: number, delta: number): void {
    const score = this.suspicion.get(seat) ?? { seat, score: 50, reasons: [] };
    score.score = Math.max(0, Math.min(100, score.score + delta));
    this.suspicion.set(seat, score);
  }

  scoreFor(seat: number): SuspicionScore | undefined {
    return this.suspicion.get(seat);
  }

  ranked(exclude: number[] = []): SuspicionScore[] {
    return [...this.suspicion.values()]
      .filter((score) => !exclude.includes(score.seat))
      .sort((a, b) => b.score - a.score);
  }

  mostSuspicious(exclude: number[] = []): SuspicionScore | undefined {
    return this.ranked(exclude)[0];
  }

  // ── analysis ──────────────────────────────────────────────────────────────────────

  lastKnownLocation(seat: number): number | undefined {
    return this.knownLocations.get(seat);
  }

  whoWasAt(location: number, round: number): number[] {
    return this.movements
      .filter((move) => move.to === location && move.round === round)
      .map((move) => move.seat);
  }

  /** Somebody who has walked the ship for rounds and finished nothing. */
  hasDoneNothing(seat: number, afterRounds: number): boolean {
    const behaviour = this.behaviours.get(seat);
    if (!behaviour) return false;
    return behaviour.tasksCompleted === 0 && this.round > afterRounds;
  }

  recentKills(limit = 3): Array<{
    victim: number;
    location: number;
    round: number;
    present: number[];
  }> {
    return this.kills.slice(-limit).map((kill) => ({
      victim: kill.victim,
      location: kill.location,
      round: kill.round,
      present: kill.possibleKillers,
    }));
  }

  private behaviour(seat: number): SeatBehaviour {
    let behaviour = this.behaviours.get(seat);
    if (!behaviour) {
      behaviour = {
        seat,
        movementPattern: [],
        tasksCompleted: 0,
        timesAccused: 0,
        votingAccuracy: 0.5,
        wasWithVictimCount: 0,
        reportedBodies: 0,
        calledMeetings: 0,
      };
      this.behaviours.set(seat, behaviour);
    }
    return behaviour;
  }
}
