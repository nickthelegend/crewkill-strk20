/** Shared vocabulary between the Cairo contract, the keeper and the browser. */

/** Mirrors `MatchPhase` in `cairo/src/objects.cairo`, same variant order. */
export enum MatchPhase {
  Lobby = 0,
  Playing = 1,
  Revealing = 2,
  Settled = 3,
  Aborted = 4,
}

/** Mirrors `CrewKillOperation`. The pool serialises the variant index. */
export enum CrewKillOperation {
  JoinSeat = 0,
  CastBallot = 1,
  Claim = 2,
}

/** Mirrors `BallotKind`. */
export enum BallotKind {
  Vote = 0,
  Kill = 1,
}

/** Where play currently is within a round. Off-chain only — the chain has no clock. */
export type RoundPhase = "night" | "meeting" | "voting" | "resolving";

export interface MatchConfig {
  stakeAmount: bigint;
  seatCount: number;
  rounds: number;
  /** Probability in basis points that any one seat draws the impostor role. */
  impostorBps: number;
  detectiveBps: number;
  protocolBps: number;
}

export interface SeatView {
  index: number;
  /** Room index on the Skeld. See `apps/keeper/src/game/ship.ts`. */
  location: number;
  locationName: string;
  tasksCompleted: number;
  totalTasks: number;
  onCameras: boolean;
  /** Display persona, assigned from `final_seed` so it is not the operator's choice. */
  persona: string;
  emoji: string;
  isAgent: boolean;
  alive: boolean;
  eliminatedRound: number | null;
  /** How the seat died, for the UI. */
  eliminatedBy: "vote" | "kill" | null;
  /** Only ever populated after the reveal window. */
  revealedRole: "crew" | "impostor" | null;
  /**
   * Published at reveal, and only then. This is what makes a finished match auditable by
   * anyone: with it you can recompute the seat's role and every ballot it cast.
   */
  roleSecret: string | null;
  claimed: boolean;
  payout: string | null;
}

export interface MatchView {
  matchId: number;
  phase: MatchPhase;
  roundPhase: RoundPhase | null;
  round: number;
  rounds: number;
  seatCount: number;
  seatsFilled: number;
  stakeAmount: string;
  potAmount: string;
  impostorBps: number;
  detectiveBps: number;
  protocolBps: number;
  seedCommitment: string;
  finalSeed: string | null;
  crewWon: boolean | null;
  impostorCount: number | null;
  detectiveWeightTotal: number;
  seats: SeatView[];
  /** Public per-round tallies. Individual ballots are never attributable. */
  tallies: Array<{ round: number; targets: Array<{ seat: number; votes: number }> }>;
  events: MatchEvent[];
  /** Which ship this match is being played on, chosen by `final_seed`. */
  mapId: string;
  mapName: string;
  /** Live sabotage: 0 none, 1 lights, 2 reactor, 3 O2, 4 comms. */
  sabotage: number;
  sabotageName: string | null;
  sabotageEndsAt: string | null;
  /** Unreported and reported bodies, for the map. */
  bodies: Array<{ victim: number; location: number; round: number; reported: boolean }>;
  /** Crew task completion, 0..1. The crew's other route to a win. */
  taskProgress: number;
  /** Seconds left in the current off-chain phase, driven by the keeper. */
  phaseEndsAt: string | null;
  txHashes: MatchTx[];
}

export interface MatchTx {
  kind: string;
  hash: string;
  at: string;
}

export interface MatchEvent {
  id: string;
  round: number;
  at: string;
  kind:
    | "match_created"
    | "seat_bought"
    | "agent_seat"
    | "match_started"
    | "night_fell"
    | "body_found"
    | "meeting_called"
    | "ballot_cast"
    | "vote_result"
    | "ejected"
    | "play_ended"
    | "seat_revealed"
    | "settled"
    | "claimed"
    | "chat";
  text: string;
  seat?: number;
  target?: number;
}

/** What the client keeps locally. Nothing here is ever sent to the keeper. */
export interface SeatKeypair {
  matchId: number;
  seatIndex: number | null;
  roleSecret: string;
  claimSecret: string;
  seatCommitment: string;
}
