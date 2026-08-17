/**
 * Test-plan items D11 and D12: the two action-panel cases that only appear in a specific
 * situation — a body in your room, and standing in Security.
 *
 * Waiting for those to happen by luck from a browser is unreliable, so this drives a real
 * seat deliberately: it walks to Security via the room graph and reports any body it finds.
 * Every action goes through the same HTTP endpoint the browser uses, and every assertion is
 * read back from the keeper's view of the world.
 */

import { actionToken, claimCommitment, randomFelt, seatCommitment, type MatchView } from "@crewkill/protocol";
import { config as loadEnv } from "dotenv";
import { makeAccount, makeProvider } from "../src/chain/client.js";
import { CrewKillContract, loadDeployment } from "../src/chain/crewkill.js";
import { MockPoolSeat } from "../src/chain/pool.js";
import { adjacencyOf, roomNameOf, shipMapForSeed, stepToward, type ShipMap } from "@crewkill/protocol";

loadEnv();
const API = process.env.API_URL ?? "http://localhost:8080";
const ActionType = { Move: 1, DoTask: 2, Report: 5, UseCams: 9 } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: Array<{ id: string; ok: boolean; detail: string }> = [];
const record = (id: string, ok: boolean, detail: string) => {
  results.push({ id, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function view(matchId: number): Promise<MatchView> {
  return (await fetch(`${API}/api/matches/${matchId}`)).json() as Promise<MatchView>;
}

async function act(matchId: number, body: unknown): Promise<number> {
  const r = await fetch(`${API}/api/matches/${matchId}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.status;
}

async function main(): Promise<void> {
  const deployment = loadDeployment(process.env.NETWORK ?? "devnet");
  const provider = makeProvider(deployment.rpcUrl);
  const game = new CrewKillContract(deployment.game, provider);

  const accounts = await fetch(deployment.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "devnet_getPredeployedAccounts", params: {} }),
  }).then((r) => r.json() as Promise<{ result: Array<{ address: string; private_key: string }> }>);

  console.log("Test plan D11 / D12 — situational action cases\n");

  // Both cases depend on where the seat happens to be, so play matches until each has been
  // observed at least once rather than declaring a pass on one lucky run.
  let camerasVerified = false;
  let reportVerified = false;
  let matchesPlayed = 0;
  const overallDeadline = Date.now() + 1_500_000;

  while ((!camerasVerified || !reportVerified) && Date.now() < overallDeadline && matchesPlayed < 8) {
    const account = accounts.result[accounts.result.length - 3];
    const wallet = new MockPoolSeat(
      "ui-cases", makeAccount(provider, account.address, account.private_key), provider,
      deployment.pool, deployment.game, deployment.stakeToken, deployment.ballot,
    );
    const roleSecret = randomFelt();
    const claimSecret = randomFelt();
    const commitment = seatCommitment(roleSecret, claimCommitment(claimSecret));
    const token = `0x${actionToken(roleSecret, claimSecret).toString(16)}`;

    let lobby: MatchView | null = null;
    while (!lobby || lobby.seatsFilled > 0) {
      lobby = (await (await fetch(`${API}/api/lobby`)).json() as { lobby: MatchView | null }).lobby;
      if (!lobby || lobby.seatsFilled > 0) await sleep(2000);
    }
    const matchId = lobby.matchId;
    await wallet.shield(BigInt(lobby.stakeAmount));
    await wallet.joinSeat(matchId, commitment, BigInt(lobby.stakeAmount));
    const seatIndex = await game.getSeatIndexFor(matchId, commitment);
    matchesPlayed += 1;
    console.log(`match ${matchId}: joined at seat ${seatIndex}`);

    const deadline = Date.now() + 300_000;
    let map: ShipMap | null = null;
    while (Date.now() < deadline) {
      const m = await view(matchId);
      if (m.phase > 1) break;
      if (!map && m.finalSeed) map = shipMapForSeed(BigInt(m.finalSeed));
      if (!map) { await sleep(2000); continue; }
      const me = m.seats[seatIndex!];
      if (!me) { await sleep(2000); continue; }
      if (!me.alive) { console.log(`  seat died in ${roomNameOf(map, me.location)}`); break; }

      if (m.roundPhase === "night") {
        const bodyHere = m.bodies.some((b) => b.location === me.location && !b.reported);
        if (bodyHere && !reportVerified) {
          const status = await act(matchId, { seatIndex, token, type: ActionType.Report });
          if (status === 200) {
            reportVerified = true;
            console.log(`  D11: reported a body in ${roomNameOf(map, me.location)} (200)`);
          }
        } else if (me.location === map.securityRoom && !camerasVerified) {
          const status = await act(matchId, { seatIndex, token, type: ActionType.UseCams });
          if (status === 200) {
            camerasVerified = true;
            console.log(`  D12: watched cameras in Security (200)`);
          }
        } else {
          const target = camerasVerified ? map.spawnRoom : map.securityRoom;
          const next = stepToward(map, me.location, target);
          if (next !== me.location) {
            const status = await act(matchId, { seatIndex, token, type: ActionType.Move, destination: next });
            console.log(
              `    r${m.round} tick: ${roomNameOf(map, me.location)} -> ${roomNameOf(map, next)} (${status})`,
            );
          }
        }
      }
      await sleep(2500);
    }
    console.log(`  after match ${matchId}: cameras=${camerasVerified} report=${reportVerified}`);
  }

  record("D12", camerasVerified,
    camerasVerified
      ? "walked a live seat into Security; the cameras action was accepted by the keeper"
      : `never reached Security alive across ${matchesPlayed} matches`);
  record("D11", reportVerified,
    reportVerified
      ? "a body shared the seat's room and the report action was accepted"
      : `no body ever shared this seat's room across ${matchesPlayed} matches`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
