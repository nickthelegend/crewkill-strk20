# Test plan

Every component and flow, with what "correct" means stated before anything is run. An item
passes only when the real result matches the stated expectation exactly, with a clean console
and no failed requests. "The button did something" is not a pass.

Sections: **A** contracts, **B** HTTP API, **C** WebSocket, **D** client, **E** chain and
persistence, **F** honestly untestable here.

---

## A. Contracts (`cairo/`)

| # | Item | Correct means |
| --- | --- | --- |
| A1 | Full match through a mock pool | Lobby opens, six seats fill, roster locks, four rounds play, seats reveal, settlement pays out, sum of payouts plus fee equals the pot |
| A2 | `create_match` rejects bad parameters | Zero seats, zero rounds, or bps over 10000 all panic |
| A3 | Keeper-only entrypoints reject others | `create_match`, `fill_agent_seat`, `start_match`, `end_play`, `abort_match` panic for a non-keeper caller |
| A4 | Owner-only entrypoints reject others | Treasury and configuration calls panic for a non-owner |
| A5 | Duplicate seat commitment rejected | Second `join_seat` with the same commitment panics |
| A6 | Underfilled roster cannot start | `start_match` panics while `seats_filled < seat_count` |
| A7 | Double reveal rejected | Second `reveal_seat` for one seat panics |
| A8 | Ballot minting is game-only | A direct mint from any other address panics |
| A9 | Role draw matches the published formula | `is_impostor` equals `poseidon(DRAW_TAG, final_seed, role_secret) mod 10000 < impostor_bps` |
| A10 | Abort refunds in full | Every seat's payout equals its stake, no fee taken |

## B. HTTP API (`apps/keeper`)

| # | Item | Correct means |
| --- | --- | --- |
| B1 | `GET /health` | 200, JSON, `ok:true`, current network, a block number that advances |
| B2 | `GET /api/config` | 200, contract addresses matching `deployments/<network>.json`, correct `realPool` |
| B3 | `GET /api/matches` | 200, JSON array, only matches for the active deployment |
| B4 | `GET /api/matches/:id` | 200, full match view with seats, tallies, events, bodies, txHashes |
| B5 | `GET /api/matches/:id` unknown id | 404 with JSON `{error}`, never HTML |
| B6 | `GET /api/matches/:id` non-numeric id | 400 with JSON `{error}`, never a stack trace |
| B7 | `GET /api/lobby` with a lobby open | 200, `{lobby: <view>}` |
| B8 | `GET /api/lobby` with none open | 200, `{lobby: null}`. Not a 404: no open lobby is an ordinary state |
| B9 | `GET /api/matches/:id/disclosure` before reveal | 200, `applicable:false`, a reason explaining nothing is openable yet |
| B10 | `GET /api/matches/:id/disclosure` after settle | 200, `applicable:true`, every revealed seat's ballots, `chainReads > 0` |
| B11 | `POST /api/matches/:id/action` bad token | 403, JSON, no state change |
| B12 | `POST /api/matches/:id/action` illegal move | 400 naming the reason, no state change |
| B13 | Amounts are strings | No JSON number exceeds 2^53; stakes and payouts serialise as strings |
| B14 | Network scoping | A keeper on network X never returns a match belonging to network Y |

## C. WebSocket

| # | Item | Correct means |
| --- | --- | --- |
| C1 | Connect | Socket opens against `/ws` without error |
| C2 | Greeting | The current match arrives on connect without asking |
| C3 | Live updates | Frames arrive as phases advance; payload parses as the same shape as the REST view |
| C4 | Recovery | Killing and restarting the keeper reconnects without a reload |

## D. Client

### D.1 Primer

| # | Item | Correct means |
| --- | --- | --- |
| D1 | First visit | Primer appears over the app |
| D2 | Three cards | Next advances through exactly three, each with its own headline |
| D3 | Dismissal is remembered | Closing then reloading does not show it again |
| D4 | Reopen | The `?` control brings it back |
| D5 | Keyboard | Escape closes, arrows move between cards |

### D.2 Lobby

| # | Item | Correct means |
| --- | --- | --- |
| D6 | Empty seats | Six slots, each labelled as awaiting an agent |
| D7 | Countdown | Ticks down once per second and does not go negative |
| D8 | Connect | Devnet key control produces a wallet and the seat controls enable |
| D9 | Shield alone | Shielding is its own transaction; the privacy band improves |
| D10 | Take seat | A real pool transaction; the seat appears in the roster with a persona |
| D11 | Seat backup | Copy and download both offered, with the warning that it is the only route to a payout |
| D12 | Deployment card | Shows the addresses actually in use, linked out on public networks |

### D.3 In play

| # | Item | Correct means |
| --- | --- | --- |
| D13 | Ship fills the viewport | The map occupies the full window with no page scroll behind it |
| D14 | No camera controls | No zoom buttons, no drag; the view never moves on its own |
| D15 | Whole ship visible | Every room of the current map is on screen at once |
| D16 | Crew positions | Sprites render in the room the API reports |
| D17 | Bodies | An unreported body renders in the room it died in |
| D18 | Sabotage | An active sabotage shows a banner and marks the room that repairs it |
| D19 | Your seat | Seat index and role shown; role is computed in the browser, never sent |
| D20 | Night actions | Only legal actions offered; an accepted one changes state |
| D21 | Meeting table | Opens on the voting phase with the crew on a circle |
| D22 | Dead seats at the table | Rendered greyed out, not removed |
| D23 | Dead cannot vote | A dead seat may open the table but not cast |
| D24 | Cast a ballot | Records on-chain and the tally reflects it |
| D25 | Ballot counts only | Counts are shown; who cast which is never claimed |
| D26 | Cutscenes | Meeting, body, ejection and result each interrupt once |
| D27 | Feed toggle | Log hides and restores |
| D28 | Reveal | Publishing the role secret is accepted once, and refused twice |
| D29 | Claim | A settled seat with a payout can claim exactly once |

### D.4 Archive

| # | Item | Correct means |
| --- | --- | --- |
| D30 | Match list | Every match for this deployment, newest first, with phase and pot |
| D31 | Totals | Counts and total staked agree with the list |
| D32 | Detail | Opening a row shows ship, outcome, per-seat roles and payouts |
| D33 | Disclosure | "Open the ballots" recovers votes and reports the on-chain read count |
| D34 | Audit | Recomputed checks shown with reasons, from published data |
| D35 | Chain ledger | Every transaction listed, linked out on public networks |

### D.5 Cross-cutting

| # | Item | Correct means |
| --- | --- | --- |
| D36 | Console clean | No errors or warnings on any surface |
| D37 | Network clean | No failed requests on any surface |
| D38 | Substrates | Phosphor and newsprint both legible, ship included, choice persists |
| D39 | Narrow viewport | No horizontal overflow at 380px |
| D40 | Keeper down | A clear reconnecting state, and automatic recovery when it returns |
| D41 | Empty states | Every panel says something useful when it has no data |
| D42 | Reduced motion | Animations disabled under `prefers-reduced-motion` |

## E. Chain and persistence

| # | Item | Correct means |
| --- | --- | --- |
| E1 | Contracts deployed | Class hash present at each address in the deployment file |
| E2 | Transactions succeed | Every recorded hash re-fetches as `SUCCEEDED` |
| E3 | Mirror matches chain | Phase, seats filled and pot agree with a direct contract read |
| E4 | Persistence | Data survives a keeper restart |
| E5 | Seed commitment honoured | Published `final_seed` matches the pre-committed hash |
| E6 | Payout conservation | Payouts plus retained fee equal the pot |
| E7 | Sepolia live | Contracts respond on Sepolia through the configured RPC |
| E8 | Sepolia writes | A real signed transaction lands and reads back |

## F. Not testable here

| # | Item | Why |
| --- | --- | --- |
| F1 | House agents against the real STRK20 pool | Needs `PROVING_SERVICE_URL`, `INDEXER_URL`, `AGENT_VIEWING_KEY`, none of which exist in this repo |
| F2 | Human seat purchase on Sepolia or mainnet | Needs a real privacy wallet driven by a person |
| F3 | Mainnet deployment | Spends real money |
| F4 | `demo_url` detection | Needs a public deployment |


---

## Execution record

Run against devnet (a real Starknet chain), Postgres, keeper on `:8080`, client on `:3100`,
driven through a real browser. Sepolia items run against the live deployment.

| Section | Result |
| --- | --- |
| A contracts | **10/10** via 39 `snforge` tests |
| B HTTP API | **14/14** |
| C WebSocket | **4/4** |
| D client | **41/42**, D26 partially observed |
| E chain and persistence | **8/8**, plus Sepolia 8/9 |
| F untestable here | 4 items, stated rather than skipped quietly |

### Failures found and fixed during this run

1. **D38 - no substrate switch on the Archive.** The console had it, the Archive did not, so
   anyone arriving there from a link could not change substrate at all. The Archive now
   carries the same controls. Re-verified: `--hull` moves between `#0c0e15` and `#e8e5dd`
   and the choice persists.
2. **D40 - reconnect took up to thirty seconds.** Backoff was capped at 30s, which is longer
   than a whole phase in this game, so a client that lost the keeper briefly sat on
   RECONNECTING well after the server was answering again. Capped at five seconds with
   jitter, plus a visibility and online listener that retries immediately. Re-verified by
   killing the keeper for twenty seconds: recovery was immediate with no reload.
3. **Fresh-clone build gap.** The Cairo artifacts and the Prisma client are generated and
   correctly gitignored, so the harnesses failed on a missing file in a fresh clone. Added
   `pnpm setup` and documented it.

### Not fully verified

- **D26 cutscenes.** Meeting and body-reported were both observed firing over a live match.
  Ejection and settle were not caught in the act during this run, so the item is recorded as
  partially observed rather than passed.
- **Sepolia S9 `abort_match`.** Fails with an account-level `Result::unwrap failed` while the
  same call succeeds on devnet. Traced as far as: the panic never reaches the game contract,
  and the contract contains no `unwrap`. Recorded as failing rather than explained away.
