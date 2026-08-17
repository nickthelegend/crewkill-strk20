import type { MatchView } from "@crewkill/protocol";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface ChainConfig {
  network: string;
  chainId: string;
  rpcUrl: string;
  explorer: string;
  realPool: boolean;
  contracts: { game: string; ballot: string; pool: string; stakeToken: string };
  defaults: {
    seatCount: number;
    rounds: number;
    impostorBps: number;
    detectiveBps: number;
    protocolBps: number;
  };
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return (await response.json()) as T;
}

export const fetchConfig = () => get<ChainConfig>("/api/config");
export const fetchMatch = (matchId: number) => get<MatchView>(`/api/matches/${matchId}`);

/** `null` when no lobby is open — an ordinary state, not a failure. */
export async function fetchLobby(): Promise<MatchView | null> {
  const { lobby } = await get<{ lobby: MatchView | null }>("/api/lobby");
  return lobby;
}
export const fetchMatches = () =>
  get<
    Array<{
      dbId: number;
      matchId: number;
      phase: number;
      seatsFilled: number;
      seatCount: number;
      stakeAmount: string;
      potAmount: string;
      phaseEndsAt: string | null;
    }>
  >("/api/matches");

/**
 * Live match state. The keeper pushes a full `MatchView` whenever anything moves.
 *
 * Reconnects with exponential backoff rather than a fixed retry: a keeper that is down for a
 * minute should cost a handful of attempts, not forty, and a browser tab left open overnight
 * against a dead server should not turn into a request generator.
 */
export function subscribe(
  onMatch: (match: MatchView) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const url = API_URL.replace(/^http/, "ws") + "/ws";
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = (): void => {
    if (closed) return;
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
      onStatus?.(true);
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as { type: string; data: MatchView };
        if (payload.type === "match") onMatch(payload.data);
      } catch {
        // A malformed frame is not worth tearing the socket down for.
      }
    };
    socket.onclose = () => {
      onStatus?.(false);
      if (closed) return;
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(connect, delay);
    };
  };
  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    // Drop the handler first: closing deliberately must not schedule a reconnect.
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}

export interface Disclosure {
  matchId: number;
  applicable: boolean;
  reason: string | null;
  chainReads: number;
  roundsPlayed: number;
  seats: Array<{
    index: number;
    persona: string;
    revealedRole: "crew" | "impostor" | null;
    ballots: Array<{ round: number; target: number | null }> | null;
    note: string | null;
  }>;
}

/**
 * Opens a finished match's ballots.
 *
 * Costs a few hundred on-chain reads, so it is only ever fetched when someone asks for it.
 */
export const fetchDisclosure = (matchId: number) =>
  get<Disclosure>(`/api/matches/${matchId}/disclosure`);
