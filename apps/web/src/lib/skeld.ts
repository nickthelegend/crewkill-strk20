/**
 * The Skeld, ported from the OneChain build's `types/game.ts`.
 *
 * Room coordinates, corridor connections and the crewmate palette are carried over verbatim
 * so the ship looks like CrewKill always looked. What changed is where the *occupants* come
 * from: seat positions are read off the live match state, which the keeper mirrors from the
 * contract, rather than from a local game loop.
 */

export const PLAYER_COLORS: Array<{ name: string; hex: string; light: string }> = [
  { name: "Red", hex: "#C51111", light: "#FF4D4D" },
  { name: "Blue", hex: "#132ED1", light: "#4D6DFF" },
  { name: "Green", hex: "#117F2D", light: "#4DFF7F" },
  { name: "Pink", hex: "#ED54BA", light: "#FF8DD9" },
  { name: "Orange", hex: "#EF7D0D", light: "#FFAB4D" },
  { name: "Yellow", hex: "#F5F557", light: "#FFFF8D" },
  { name: "Black", hex: "#3F474E", light: "#6B7580" },
  { name: "White", hex: "#D6E0F0", light: "#FFFFFF" },
  { name: "Purple", hex: "#6B2FBB", light: "#9B5FEB" },
  { name: "Brown", hex: "#71491E", light: "#A17B4E" },
  { name: "Cyan", hex: "#38FEDC", light: "#7AFFEC" },
  { name: "Lime", hex: "#50EF39", light: "#8AFF6D" },
];

export function colorFor(seatIndex: number) {
  return PLAYER_COLORS[seatIndex % PLAYER_COLORS.length];
}

export interface RoomBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room boxes in map space. The viewBox below is sized to contain all of them. */
export const MAP_LAYOUT: Record<number, RoomBox> = {
  5: { x: 50, y: 40, width: 100, height: 80 }, // Upper Engine
  4: { x: 200, y: 40, width: 100, height: 80 }, // MedBay
  0: { x: 350, y: 40, width: 110, height: 80 }, // Cafeteria
  9: { x: 500, y: 40, width: 110, height: 80 }, // Weapons
  8: { x: 50, y: 155, width: 100, height: 70 }, // Reactor
  1: { x: 380, y: 155, width: 80, height: 70 }, // Admin
  10: { x: 530, y: 155, width: 80, height: 70 }, // Navigation
  12: { x: 650, y: 155, width: 80, height: 70 }, // O2
  7: { x: 50, y: 260, width: 100, height: 70 }, // Security
  2: { x: 350, y: 260, width: 110, height: 80 }, // Storage
  11: { x: 530, y: 260, width: 80, height: 70 }, // Shields
  6: { x: 50, y: 365, width: 100, height: 70 }, // Lower Engine
  3: { x: 200, y: 365, width: 100, height: 70 }, // Electrical
  13: { x: 350, y: 470, width: 110, height: 70 }, // Communications
};

/** Corridors, drawn between room centres. */
export const ROOM_CONNECTIONS: Array<[number, number]> = [
  [5, 4],
  [4, 0],
  [0, 9],
  [5, 8],
  [8, 7],
  [7, 6],
  [0, 1],
  [1, 2],
  [6, 3],
  [3, 2],
  [9, 10],
  [10, 12],
  [10, 11],
  [11, 2],
  [2, 13],
];

export const MAP_VIEWBOX = { width: 790, height: 570 };

export function roomCentre(location: number): { x: number; y: number } {
  const box = MAP_LAYOUT[location];
  if (!box) return { x: 0, y: 0 };
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Where a seat stands inside its room.
 *
 * Occupants are laid out along a row so a crowded room reads as a crowd rather than a single
 * sprite with five others hidden behind it — which matters, because "who was in the room"
 * is the whole game.
 */
export function standingSpot(
  location: number,
  indexInRoom: number,
  occupants: number,
): { x: number; y: number } {
  const box = MAP_LAYOUT[location];
  if (!box) return { x: 0, y: 0 };
  const perRow = Math.min(occupants, 3);
  const row = Math.floor(indexInRoom / 3);
  const col = indexInRoom % 3;
  const rows = Math.ceil(occupants / 3);
  const spacing = box.width / (perRow + 1);
  return {
    x: box.x + spacing * (col + 1),
    y: box.y + box.height * (rows === 1 ? 0.62 : 0.45 + row * 0.32),
  };
}
