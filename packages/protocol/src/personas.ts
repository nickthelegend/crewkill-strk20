/**
 * Agent personas, carried over from the OneChain build of CrewKill.
 *
 * A persona is purely cosmetic-plus-behavioural: it drives how an agent plays, never what
 * role it holds. Roles come from the on-chain draw and no persona can influence them.
 */

export type CrewmateStyle =
  | "task-focused"
  | "detective"
  | "group-safety"
  | "vigilante"
  | "conservative";

export type ImpostorStyle =
  | "stealth"
  | "aggressive"
  | "saboteur"
  | "social-manipulator"
  | "frame-game";

export interface Persona {
  name: string;
  emoji: string;
  title: string;
  crewmateStyle: CrewmateStyle;
  impostorStyle: ImpostorStyle;
  crewmateDesc: string;
  impostorDesc: string;
  playstyle: "Aggressive" | "Defensive" | "Balanced" | "Chaotic" | "Strategic";
  /** 0–1. How readily the agent accuses on thin evidence. */
  aggression: number;
  /** 0–1. How much it weights another seat's claims. */
  trust: number;
  /** 0–1. How likely it is to act on the first plausible read rather than wait. */
  impulsiveness: number;
}

const CREWMATE_TRAITS: Record<
  CrewmateStyle,
  { emoji: string; title: string; desc: string; playstyle: Persona["playstyle"] }
> = {
  "task-focused": {
    emoji: "⚡",
    title: "Speedrunner",
    desc: "Rushes tasks to win fast. Avoids discussions.",
    playstyle: "Aggressive",
  },
  detective: {
    emoji: "🔍",
    title: "Investigator",
    desc: "Watches cameras, tracks movements, spots lies.",
    playstyle: "Strategic",
  },
  "group-safety": {
    emoji: "🛡️",
    title: "Bodyguard",
    desc: "Stays with crew for safety. Never alone.",
    playstyle: "Defensive",
  },
  vigilante: {
    emoji: "⚔️",
    title: "Hunter",
    desc: "Aggressively accuses suspects. Votes fast.",
    playstyle: "Aggressive",
  },
  conservative: {
    emoji: "🧠",
    title: "Analyst",
    desc: "Only votes with strong evidence. Careful player.",
    playstyle: "Strategic",
  },
};

const IMPOSTOR_TRAITS: Record<ImpostorStyle, string> = {
  stealth: "Kills isolated targets. Builds solid alibis.",
  aggressive: "Quick kills. Blames others immediately.",
  saboteur: "Creates chaos with sabotage. Splits crew.",
  "social-manipulator": "Gains trust early. Betrays late game.",
  "frame-game": "Self-reports bodies. Frames innocents.",
};

function persona(
  name: string,
  crewmateStyle: CrewmateStyle,
  impostorStyle: ImpostorStyle,
  aggression: number,
  trust: number,
  impulsiveness: number,
): Persona {
  const crew = CREWMATE_TRAITS[crewmateStyle];
  return {
    name,
    emoji: crew.emoji,
    title: crew.title,
    crewmateStyle,
    impostorStyle,
    crewmateDesc: crew.desc,
    impostorDesc: IMPOSTOR_TRAITS[impostorStyle],
    playstyle: crew.playstyle,
    aggression,
    trust,
    impulsiveness,
  };
}

/**
 * The house roster. Any seat a human does not buy is filled from here, so a lobby always
 * reaches quorum and a funded match never fails to run.
 */
export const ROSTER: Persona[] = [
  persona("Neo", "detective", "stealth", 0.45, 0.5, 0.35),
  persona("Trinity", "vigilante", "aggressive", 0.85, 0.3, 0.8),
  persona("Morpheus", "group-safety", "social-manipulator", 0.4, 0.75, 0.3),
  persona("Smith", "conservative", "frame-game", 0.6, 0.2, 0.4),
  persona("Cypher", "task-focused", "saboteur", 0.7, 0.25, 0.9),
  persona("Niobe", "detective", "aggressive", 0.65, 0.45, 0.55),
  persona("Dozer", "group-safety", "stealth", 0.3, 0.8, 0.25),
  persona("Switch", "vigilante", "frame-game", 0.9, 0.15, 0.85),
  persona("Tank", "task-focused", "social-manipulator", 0.5, 0.6, 0.6),
  persona("Oracle", "conservative", "saboteur", 0.35, 0.7, 0.2),
  persona("Apoc", "detective", "frame-game", 0.55, 0.4, 0.5),
  persona("Mouse", "task-focused", "aggressive", 0.75, 0.35, 0.95),
];

/**
 * Assigns display personas from `final_seed` rather than by seat order, so which persona a
 * seat wears is as unbiasable as its role. Purely cosmetic, but it stops an operator from
 * signalling anything through the roster.
 */
export function assignPersonas(finalSeed: bigint, seatCount: number): Persona[] {
  const pool = [...ROSTER];
  const out: Persona[] = [];
  let entropy = finalSeed;
  for (let i = 0; i < seatCount; i += 1) {
    const pick = Number(entropy % BigInt(pool.length));
    out.push(pool.splice(pick, 1)[0]);
    entropy /= BigInt(pool.length || 1);
    if (entropy === 0n) entropy = finalSeed + BigInt(i + 1);
  }
  return out;
}
