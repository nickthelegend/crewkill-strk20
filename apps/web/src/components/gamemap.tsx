"use client";

import { NO_TARGET, type MatchView } from"@crewkill/protocol";
import { SABOTAGE_FIX_ROOMS, roomName } from"@/lib/ship";
import {
  MAP_LAYOUT,
  MAP_VIEWBOX,
  ROOM_CONNECTIONS,
  colorFor,
  roomCentre,
  standingSpot,
} from"@/lib/skeld";
import { Crewmate, DeadBody } from"./sprite";

/**
 * The ship.
 *
 * Rooms, corridors and crewmates drawn as they were in the OneChain build, driven entirely
 * by live match state. A seat's position here is the same number the keeper mirrors from its
 * world and the same one an agent reasons about, so what you watch is what the game is
 * actually doing - not a decorative animation running alongside it.
 */
export function GameMap({
  match,
  yourSeat,
  onRoomClick,
  reachable = [],
}: {
  match: MatchView;
  yourSeat: number | null;
  onRoomClick?: (location: number) => void;
  reachable?: number[];
}) {
  const sabotagedRooms = match.sabotage ? (SABOTAGE_FIX_ROOMS[match.sabotage] ?? []) : [];
  const lightsOut = match.sabotage === 1;

  // Group the living by room so a crowd lays out as a crowd.
  const byRoom = new Map<number, MatchView["seats"]>();
  for (const seat of match.seats) {
    if (!seat.alive) continue;
    const list = byRoom.get(seat.location) ?? [];
    list.push(seat);
    byRoom.set(seat.location, list);
  }

  const bodiesByRoom = new Map<number, MatchView["bodies"]>();
  for (const body of match.bodies) {
    const list = bodiesByRoom.get(body.location) ?? [];
    list.push(body);
    bodiesByRoom.set(body.location, list);
  }

  return (
    <div className="relative overflow-hidden  border border-[var(--color-line)] bg-[#080b14]">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        className="block w-full"
        role="img"
        aria-label="The Skeld, showing where every seat currently is"
      >
        <defs>
          <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141b2c" />
            <stop offset="100%" stopColor="#0d1220" />
          </linearGradient>
        </defs>

        {/* Corridors first, so rooms sit on top of them. */}
        {ROOM_CONNECTIONS.map(([a, b]) => {
          const from = roomCentre(a);
          const to = roomCentre(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#1e2637"
              strokeWidth={18}
              strokeLinecap="round"
            />
          );
        })}

        {Object.entries(MAP_LAYOUT).map(([key, box]) => {
          const location = Number(key);
          const occupants = byRoom.get(location) ?? [];
          const bodies = bodiesByRoom.get(location) ?? [];
          const sabotaged = sabotagedRooms.includes(location);
          const canMoveHere = reachable.includes(location);
          const youAreHere = occupants.some((seat) => seat.index === yourSeat);

          return (
            <g
              key={key}
              onClick={canMoveHere && onRoomClick ? () => onRoomClick(location) : undefined}
              style={{ cursor: canMoveHere ?"pointer" :"default" }}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={8}
                fill="url(#hull)"
                stroke={
                  sabotaged
                    ?"var(--color-alarm)"
                    : youAreHere
                      ?"var(--color-cyan)"
                      : canMoveHere
                        ?"rgba(86,211,240,0.45)"
                        :"#243049"
                }
                strokeWidth={sabotaged || youAreHere ? 3 : canMoveHere ? 2 : 1.5}
                className={sabotaged ?"room-alarm" : undefined}
              />

              <text
                x={box.x + 8}
                y={box.y + 16}
                fill={sabotaged ?"var(--color-alarm)" :"#6b7690"}
                fontSize={10}
                letterSpacing={1}
                style={{ textTransform:"uppercase" }}
              >
                {roomName(location)}
              </text>

              {/* Dead bodies lie where they fell. */}
              {bodies.map((body, i) => (
                <foreignObject
                  key={`body-${body.victim}`}
                  x={box.x + 8 + i * 30}
                  y={box.y + box.height - 30}
                  width={40}
                  height={30}
                >
                  <DeadBody seatIndex={body.victim} size={30} />
                </foreignObject>
              ))}

              {occupants.map((seat, i) => {
                const spot = standingSpot(location, i, occupants.length);
                return (
                  <foreignObject
                    key={seat.index}
                    x={spot.x - 20}
                    y={spot.y - 26}
                    width={40}
                    height={52}
                    style={{ transition:"x 700ms ease, y 700ms ease" }}
                  >
                    <Crewmate
                      seatIndex={seat.index}
                      size={34}
                      alive={seat.alive}
                      moving={match.roundPhase ==="night"}
                      name={seat.persona}
                      showName
                      highlight={seat.index === yourSeat}
                      onCameras={seat.onCameras}
                    />
                  </foreignObject>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Lights sabotage dims the ship, exactly as it should. */}
      {lightsOut && (
        <div className="pointer-events-none absolute inset-0 bg-[var(--color-panel)] mix-blend-multiply" />
      )}

      {match.roundPhase && (
        <div className="pointer-events-none absolute right-3 top-3  bg-[var(--color-panel)] px-2 py-1 tele">
          {match.roundPhase ==="night" ?"night" : match.roundPhase}
        </div>
      )}
    </div>
  );
}

/** Per-round vote bars, drawn as a meeting table rather than a table of numbers. */
export function VoteBoard({ match }: { match: MatchView }) {
  const round = match.tallies.find((tally) => tally.round === match.round);
  if (!round) return null;
  const most = Math.max(...round.targets.map((target) => target.votes), 1);

  return (
    <div className="space-y-1.5">
      {round.targets
        .slice()
        .sort((a, b) => b.votes - a.votes)
        .map((target) => {
          const seat = target.seat === NO_TARGET ? null : match.seats[target.seat];
          return (
            <div key={target.seat} className="flex items-center gap-2">
              <span className="w-6">
                {seat ? (
                  <Crewmate seatIndex={seat.index} size={18} showName={false} />
                ) : (
                  <span className="text-[11px] text-[var(--color-dim)]">-</span>
                )}
              </span>
              <span className="w-20 shrink-0 truncate text-[12px]">
                {seat ? seat.persona :"skip"}
              </span>
              <span
                className="h-2"
                style={{
                  width: `${(target.votes / most) * 60}%`,
                  backgroundColor: seat ? colorFor(seat.index).hex :"#3f474e",
                }}
              />
              <span className="tabular-nums text-[11px] text-[var(--color-dim)]">
                {target.votes}
              </span>
            </div>
          );
        })}
    </div>
  );
}
