"use client";

import type { MatchView } from"@crewkill/protocol";
import {
  ADJACENCY,
  ActionType,
  SABOTAGE_FIX_ROOMS,
  SECURITY,
  TASK_ROOMS,
  VENTS,
  roomName,
} from"@/lib/ship";
import { Panel } from"./pieces";

/** A live sabotage is the loudest thing on screen, because it should be. */
export function SabotageBanner({ match }: { match: MatchView }) {
  if (!match.sabotage) return null;
  const critical = match.sabotage === 2 || match.sabotage === 3;
  const rooms = (SABOTAGE_FIX_ROOMS[match.sabotage] ?? []).map(roomName).join(" or");
  return (
    <div
      className={` border px-4 py-3 text-sm ${
        critical
          ?"border-[var(--color-alarm)] bg-[var(--color-alarm)]/15 text-[var(--color-alarm)]"
          :"border-[var(--color-amber)]/50 bg-[var(--color-amber)]/10 text-[var(--color-amber)]"
      }`}
    >
      <strong>{match.sabotageName}</strong> - get to {rooms}
      {critical ?" before the timer runs out." :" to bring it back online."}
    </div>
  );
}

export function TaskProgress({ match }: { match: MatchView }) {
  const pct = Math.round(match.taskProgress * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between tele">
        <span>crew tasks</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden  bg-[var(--color-line)]">
        <div
          className="h-full  bg-[var(--color-signal)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-dim)]">
        Finish every task and the crew wins without catching anybody.
      </p>
    </div>
  );
}

/** Where everyone is, grouped by room. Alibis are built out of this. */
export function ShipMap({ match, yourSeat }: { match: MatchView; yourSeat: number | null }) {
  const rooms = new Map<number, MatchView["seats"]>();
  for (const seat of match.seats) {
    if (!seat.alive) continue;
    const list = rooms.get(seat.location) ?? [];
    list.push(seat);
    rooms.set(seat.location, list);
  }
  const occupied = [...rooms.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <Panel title="Ship">
      {occupied.length === 0 ? (
        <p className="text-[13px] text-[var(--color-dim)]">The ship is quiet.</p>
      ) : (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {occupied.map(([location, seats]) => {
            const bodiesHere = match.bodies.filter((body) => body.location === location);
            return (
              <div
                key={location}
                className={`min-w-0  border p-2 ${
                  seats.some((seat) => seat.index === yourSeat)
                    ?"border-[var(--color-cyan)]/60"
                    :"border-[var(--color-line)]"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--color-dim)]">
                  <span>{roomName(location)}</span>
                  {bodiesHere.length > 0 && (
                    <span className="text-[var(--color-alarm)]">☠ {bodiesHere.length}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {seats.map((seat) => (
                    <span
                      key={seat.index}
                      title={`${seat.persona} - ${seat.tasksCompleted}/${seat.totalTasks} tasks`}
                      className={` px-1.5 py-0.5 text-[11px] ${
                        seat.index === yourSeat
                          ?"bg-[var(--color-cyan)]/20 text-[var(--color-cyan)]"
                          :"bg-[var(--color-line)]"
                      }`}
                    >
                      {seat.emoji} {seat.persona}
                      {seat.onCameras ?" 📹" :""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export interface ActionRequest {
  type: ActionType;
  destination?: number;
  target?: number;
  sabotage?: number;
}

/** What you can actually do this tick, given where you are and who you are. */
export function ActionPanel({
  match,
  yourSeat,
  role,
  busy,
  onAction,
}: {
  match: MatchView;
  yourSeat: number;
  role:"crew" |"impostor" | null;
  busy: boolean;
  onAction: (action: ActionRequest) => void;
}) {
  const me = match.seats[yourSeat];
  if (!me || !me.alive) {
    return (
      <p className="text-[13px] text-[var(--color-dim)]">
        You are dead. You still hold your stake, your vote receipts, and any Detective Pool
        share you earned while alive.
      </p>
    );
  }

  const here = me.location;
  const bodyHere = match.bodies.some((body) => body.location === here);
  const canTask = TASK_ROOMS.includes(here) && me.tasksCompleted < me.totalTasks;
  const canFix =
    match.sabotage > 0 && (SABOTAGE_FIX_ROOMS[match.sabotage] ?? []).includes(here);
  const targets = match.seats.filter(
    (seat) => seat.alive && seat.index !== yourSeat && seat.location === here,
  );

  const Button = ({
    label,
    tone,
    onClick,
  }: {
    label: string;
    tone?: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className={` border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
        tone ??"border-[var(--color-line)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 text-[13px]">
      <div className="text-[var(--color-dim)]">
        You are in <span className="text-[var(--color-ink)]">{roomName(here)}</span>.{" "}
        {me.tasksCompleted}/{me.totalTasks} tasks
      </div>

      <div>
        <div className="mb-1 tele">
          move
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(ADJACENCY[here] ?? []).map((room) => (
            <Button
              key={room}
              label={roomName(room)}
              onClick={() => onAction({ type: ActionType.Move, destination: room })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {canTask && <Button label="do task" onClick={() => onAction({ type: ActionType.DoTask })} />}
        {canFix && (
          <Button
            label="fix sabotage"
            tone="border-[var(--color-amber)]/50 text-[var(--color-amber)]"
            onClick={() => onAction({ type: ActionType.FixSabotage })}
          />
        )}
        {bodyHere && (
          <Button
            label="report body"
            tone="border-[var(--color-alarm)]/50 text-[var(--color-alarm)]"
            onClick={() => onAction({ type: ActionType.Report })}
          />
        )}
        {here === SECURITY && (
          <Button label="watch cameras" onClick={() => onAction({ type: ActionType.UseCams })} />
        )}
        <Button
          label="emergency meeting"
          onClick={() => onAction({ type: ActionType.CallMeeting })}
        />
      </div>

      {role ==="impostor" && (
        <div className="space-y-2  border border-[var(--color-alarm)]/30 p-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-alarm)]">
            impostor
          </div>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((seat) => (
              <Button
                key={seat.index}
                label={`eliminate ${seat.persona}`}
                tone="border-[var(--color-alarm)]/50 text-[var(--color-alarm)]"
                onClick={() => onAction({ type: ActionType.Kill, target: seat.index })}
              />
            ))}
            {(VENTS[here] ?? []).map((room) => (
              <Button
                key={`vent-${room}`}
                label={`vent → ${roomName(room)}`}
                tone="border-[var(--color-alarm)]/40 text-[var(--color-alarm)]"
                onClick={() => onAction({ type: ActionType.Vent, destination: room })}
              />
            ))}
            {match.sabotage === 0 &&
              [1, 2, 3, 4].map((type) => (
                <Button
                  key={`sab-${type}`}
                  label={`sabotage ${type === 1 ?"lights" : type === 2 ?"reactor" : type === 3 ?"O2" :"comms"}`}
                  tone="border-[var(--color-alarm)]/40 text-[var(--color-alarm)]"
                  onClick={() => onAction({ type: ActionType.Sabotage, sabotage: type })}
                />
              ))}
          </div>
          <p className="text-[11px] text-[var(--color-dim)]">
            An elimination is recorded on-chain as a private ballot, so the kill costs a pool
            action and nobody can see it came from you. Bluffing one you are not entitled to
            costs your whole stake at settlement.
          </p>
        </div>
      )}
    </div>
  );
}
