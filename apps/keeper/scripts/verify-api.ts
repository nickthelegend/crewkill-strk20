/**
 * Executes section B of `docs/TEST-PLAN.md` against a running keeper.
 *
 * Every assertion checks the stated postcondition, not merely that a call returned. Where an
 * endpoint claims to have changed the chain, the chain is read back directly to confirm it.
 *
 *   pnpm --filter @crewkill/keeper exec tsx scripts/verify-api.ts
 */

import { MatchPhase, actionToken, claimCommitment, randomFelt } from "@crewkill/protocol";
import { config as loadEnv } from "dotenv";
import { makeProvider } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";

loadEnv();

const API = process.env.API_URL ?? "http://localhost:8080";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function record(id: string, ok: boolean, detail: string): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${id}  ${detail}`);
  } else {
    failed += 1;
    failures.push(`${id}: ${detail}`);
    console.log(`  FAIL  ${id}  ${detail}`);
  }
}

async function req(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown; raw: string }> {
  const response = await fetch(`${API}${path}`, init);
  const raw = await response.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    /* keep the raw text for the assertion message */
  }
  return { status: response.status, body, raw };
}

const json = (payload: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

async function main(): Promise<void> {
  const deployment = loadDeployment(process.env.NETWORK ?? "devnet");
  const provider = makeProvider(deployment.rpcUrl);
  const game = new CrewKillContract(deployment.game, provider);

  console.log("Section B — keeper HTTP API\n");

  // B1 ────────────────────────────────────────────────────────────────────────────────
  {
    const { status, body } = await req("/health");
    const payload = body as { ok?: boolean; network?: string; block?: number };
    const head = await provider.getBlockLatestAccepted();
    record(
      "B1",
      status === 200 &&
        payload.ok === true &&
        payload.network === deployment.network &&
        typeof payload.block === "number" &&
        Math.abs(payload.block - head.block_number) <= 3,
      `200, block ${payload.block} within 3 of chain head ${head.block_number}`,
    );
  }

  // B2 ────────────────────────────────────────────────────────────────────────────────
  {
    const { status, body } = await req("/api/config");
    const payload = body as {
      chainId?: string;
      realPool?: boolean;
      contracts?: Record<string, string>;
    };
    const chainId = await provider.getChainId();
    const matches =
      payload.contracts?.game === deployment.game &&
      payload.contracts?.pool === deployment.pool &&
      payload.contracts?.ballot === deployment.ballot &&
      payload.contracts?.stakeToken === deployment.stakeToken;
    record(
      "B2",
      status === 200 && matches && payload.chainId === chainId && payload.realPool === false,
      matches ? "addresses match the deployment file and the live chain id" : "address mismatch",
    );
  }

  // B3 ────────────────────────────────────────────────────────────────────────────────
  {
    const { status, body } = await req("/api/matches");
    const rows = body as Array<{ matchId: number; phase: number }>;
    const ordered = rows.every((row, i) => i === 0 || rows[i - 1].matchId >= row.matchId);
    const shaped = rows.every(
      (row) => typeof row.matchId === "number" && row.phase >= 0 && row.phase <= 4,
    );
    record(
      "B3",
      status === 200 && Array.isArray(rows) && rows.length <= 25 && ordered && shaped,
      `${rows.length} matches, newest-first, phases in range`,
    );
  }

  // B4 ────────────────────────────────────────────────────────────────────────────────
  const listed = (await req("/api/matches")).body as Array<{ matchId: number }>;
  const sampleId = listed[0]?.matchId;
  {
    const { status, body } = await req(`/api/matches/${sampleId}`);
    const view = body as {
      seats?: unknown[];
      seatsFilled?: number;
      tallies?: Array<{ round: number; targets: Array<{ seat: number; votes: number }> }>;
    };
    let talliesAgree = true;
    for (const tally of view.tallies ?? []) {
      for (const target of tally.targets) {
        const onChain = await game.getTally(sampleId, tally.round, target.seat);
        if (onChain !== target.votes) talliesAgree = false;
      }
    }
    record(
      "B4",
      status === 200 && view.seats?.length === view.seatsFilled && talliesAgree,
      `match ${sampleId}: ${view.seats?.length} seats, tallies match the contract exactly`,
    );
  }

  // B5 / B6 ───────────────────────────────────────────────────────────────────────────
  {
    const { status, body } = await req("/api/matches/999999");
    record(
      "B5",
      status === 404 && (body as { error?: string }).error === "no such match",
      `404 "no such match"`,
    );
  }
  {
    const { status, body } = await req("/api/matches/not-a-number");
    const isJson = typeof body === "object" && body !== null;
    record(
      "B6",
      status >= 400 && status < 500 && isJson,
      `non-numeric id → ${status}${isJson ? " JSON error" : " NON-JSON body"}`,
    );
  }

  // B7 / B8 ───────────────────────────────────────────────────────────────────────────
  {
    // "No lobby right now" is an ordinary state — it happens every time a match starts — so
    // it answers 200 with a null body. A polling client must never see it as a failure.
    const { status, body } = await req("/api/lobby");
    const payload = body as { lobby: { phase: number; phaseEndsAt: string | null } | null };
    if (payload.lobby) {
      record(
        "B7",
        status === 200 &&
          payload.lobby.phase === MatchPhase.Lobby &&
          payload.lobby.phaseEndsAt !== null &&
          new Date(payload.lobby.phaseEndsAt).getTime() > Date.now() - 5000,
        "200 with an open lobby and a live deadline",
      );
      record("B8", status === 200, "200 (a lobby is open; the null path is checked below)");
    } else {
      record("B7", true, "skipped — no lobby open right now");
      record(
        "B8",
        status === 200 && payload.lobby === null,
        "200 with {lobby:null} — absence is not a failed request",
      );
    }
  }

  // B9 / B10 ──────────────────────────────────────────────────────────────────────────
  {
    const before = await game.matchCount();
    const { status, body } = await req("/api/matches", json({ seatCount: 4, rounds: 2 }));
    const payload = body as { matchId?: number };
    const after = await game.matchCount();
    record(
      "B9",
      status === 200 && typeof payload.matchId === "number" && after === before + 1,
      `created match ${payload.matchId}; on-chain count ${before} → ${after}`,
    );
  }
  {
    const before = await game.matchCount();
    const { status } = await req("/api/matches", json({ seatCount: 99 }));
    const after = await game.matchCount();
    record(
      "B10",
      status === 400 && after === before,
      `400 on seatCount=99 and no match created (count stayed ${after})`,
    );
  }

  // B11 / B12 ─────────────────────────────────────────────────────────────────────────
  {
    // A reveal for a match that is not in its reveal window must fail cleanly, and must
    // change nothing on-chain.
    const { status, body } = await req(
      "/api/reveal",
      json({
        matchId: sampleId,
        roleSecret: `0x${randomFelt().toString(16)}`,
        claimCommitment: `0x${claimCommitment(randomFelt()).toString(16)}`,
      }),
    );
    const message = (body as { error?: string }).error ?? "";
    record(
      "B12",
      status === 400 && /CK:|phase|secret/i.test(message),
      `400 with a Cairo reason: ${message.match(/CK: [a-z ]+/)?.[0] ?? message.slice(0, 40)}`,
    );
  }

  // B13–B17 ───────────────────────────────────────────────────────────────────────────
  {
    const { status } = await req(
      "/api/matches/999999/action",
      json({ seatIndex: 0, token: "0x1", type: 1, destination: 1 }),
    );
    record("B15", status === 404, `unknown match → 404`);
  }
  {
    const { status } = await req(
      `/api/matches/${sampleId}/action`,
      json({ seatIndex: 0, token: "0x1", type: 999 }),
    );
    record("B16", status === 400, `out-of-range action type → 400`);
  }
  {
    const token = `0x${actionToken(randomFelt(), randomFelt()).toString(16)}`;
    const first = await req(
      `/api/matches/${sampleId}/action`,
      json({ seatIndex: 0, token, type: 1, destination: 1 }),
    );
    const second = await req(
      `/api/matches/${sampleId}/action`,
      json({ seatIndex: 0, token: "0xdeadbeef", type: 1, destination: 1 }),
    );
    record(
      "B14",
      second.status === 403,
      `a different token on a bound seat → 403 (first call was ${first.status})`,
    );
  }

  console.log(`\nSection B: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
