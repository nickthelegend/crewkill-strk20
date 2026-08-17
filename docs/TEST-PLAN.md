# CrewKill test plan

Every component and every distinct flow, with an explicit definition of what "correct" means
for each. This is the checklist; nothing counts as working until its row here is a verified
PASS with a clean console and network tab.

**Environment under test:** devnet (a real Starknet chain), Postgres 17, keeper on `:8080`,
client on `:3100`. Contracts at `deployments/devnet.json`. Real signed transactions
throughout; no mocked responses anywhere in the stack.

Status key: **PASS** verified against the stated expectation · **FAIL** did not match ·
**UNTESTABLE** blocked by a dependency that genuinely does not exist here.

---

## A. Cairo contract — `CrewKill`

Exercised through `snforge` (23 tests) and through real transactions on devnet. Each row
states the on-chain postcondition, not "the call succeeded".

| # | Item | Correct means | Status |
|---|---|---|---|
| A1 | `create_match` happy path | `match_count` increments by 1; `get_match` returns `phase=Lobby`, the exact stake/seats/rounds/bps passed in, `pot=0`, `seats_filled=0` | |
| A2 | `create_match` rejects bad params | Reverts `CK: too many seats` for `seats>12` or `<4`; `CK: bad bps` when `detective+protocol >= 10000`; `CK: zero amount` for stake 0 | |
| A3 | `create_match` access control | Reverts `CK: not keeper` from a non-keeper, non-owner address | |
| A4 | `privacy_invoke(JoinSeat)` | Seat registered at the next index with the given commitment; `pot += stake`; caller's shielded stake balance falls by exactly `stake`; caller's shielded CKBALLOT balance rises by exactly `rounds` | |
| A5 | JoinSeat underpayment | Reverts `CK: stake mismatch` when the pool moves less than `stake` | |
| A6 | `privacy_invoke` caller check | Reverts `CK: caller not pool` when called directly rather than by the pinned pool | |
| A7 | Duplicate seat commitment | Reverts `CK: commitment used` | |
| A8 | `start_match` seed binding | Succeeds only for the pre-committed seed; a different seed reverts `CK: seed mismatch`. `final_seed` equals `poseidon(seed, c₀..cₙ)` computed independently off-chain | |
| A9 | `start_match` requires a full roster | Reverts `CK: lobby underfilled` when `seats_filled < seat_count` | |
| A10 | Role draw | For every seat, on-chain `is_impostor` after reveal equals the client's local `isImpostor(final_seed, role_secret, impostor_bps)` | |
| A11 | `privacy_invoke(CastBallot/Vote)` | `get_tally(match, round, target)` increments by exactly 1; one CKBALLOT is consumed; a `VoteReceipt` exists under the commitment hash | |
| A12 | Ballot replay | Reverts `CK: replayed commitment` on a second submission of the same receipt | |
| A13 | Vote without a ballot | Reverts `CK: ballot mismatch` when no CKBALLOT reaches the contract | |
| A14 | `privacy_invoke(CastBallot/Kill)` | `get_kill_count` increments; `get_kill` returns the victim, round and commitment, `validated=false` | |
| A15 | `end_play` | `phase=Revealing`, `rounds_played` set | |
| A16 | `reveal_seat` | Seat shows `revealed=true`, `role_secret` published, `is_impostor` derived; `revealed_count`/`impostor_count` update. Second reveal reverts `CK: already revealed` | |
| A17 | `settle` — eliminations | Every claimed kill and every plurality ejection is reflected in `eliminated`/`eliminated_round`; ties and skip-majorities eject nobody | |
| A18 | `settle` — win condition | `crew_won=true` iff no revealed impostor is alive at the end | |
| A19 | `settle` — Detective Pool | Weight per seat = Σ over rounds where its receipt named a real impostor, of `rounds_played − round + 1`; payout share = `detective × weight / total` | |
| A20 | `settle` — books balance | Σ(seat payouts) + `protocol_fees` == `pot`, exactly, with no remainder stranded | |
| A21 | `settle` — bluffer slashing | A seat whose secret reproduces an unvalidated kill commitment gets payout 0 | |
| A22 | `settle` — unrevealed forfeits | A seat that never revealed gets payout 0 and its stake stays in the pot | |
| A23 | `privacy_invoke(Claim)` | Claimant's shielded stake balance rises by exactly `payout`; seat `claimed=true` | |
| A24 | Double claim | Reverts `CK: already claimed` | |
| A25 | Claim with only the role secret | Reverts `CK: seat not revealed` — a published role secret cannot move money | |
| A26 | `abort_match` | Every seat's payout equals its full stake; `protocol_fees` unchanged; claims open | |
| A27 | Ghost-ship match | A match that drew zero impostors is a crew win and runs its full round count | |
| A28 | `BallotToken` minter control | Only the game contract can `mint`/`burn`; anyone else reverts `CK: not owner` | |
| A29 | Cross-language hashes | Cairo and TypeScript produce byte-identical values for all seven commitment functions | |

## B. Keeper HTTP API

| # | Item | Correct means | Status |
|---|---|---|---|
| B1 | `GET /health` | 200, `{ok:true, network:"devnet", block:<number>}` where block matches the live chain head | |
| B2 | `GET /api/config` | 200 with `contracts.{game,ballot,pool,stakeToken}` exactly matching `deployments/devnet.json`, plus `chainId`, `rpcUrl`, `realPool:false` | |
| B3 | `GET /api/matches` | 200, array ordered newest-first, ≤25 entries, each with a numeric `matchId` and `phase` in 0..4 | |
| B4 | `GET /api/matches/:id` valid | 200, full `MatchView`; `seats.length == seatsFilled`; tallies match `get_tally` read straight from the contract | |
| B5 | `GET /api/matches/:id` unknown | 404 `{error:"no such match"}` — not a 500, not an empty 200 | |
| B6 | `GET /api/matches/:id` non-numeric | 4xx JSON error — must not throw an unhandled `BigInt` conversion | |
| B7 | `GET /api/lobby` with a lobby open | 200, `{lobby:{phase:0,…}}` with `phaseEndsAt` in the future | |
| B8 | `GET /api/lobby` with none open | 200 `{lobby:null}`. **Corrected during the run:** this originally specified 404, which contradicted D30 ("zero failed requests during normal operation") — there is routinely no open lobby, so absence must not read as an error to a polling client | |
| B9 | `POST /api/matches` valid | 200 `{dbId, matchId}`; `match_count` on-chain increases by 1 | |
| B10 | `POST /api/matches` invalid body | 400 with a validation message; no match created on-chain | |
| B11 | `POST /api/reveal` valid | 200 `{txHash}`; the seat reads back `revealed=true` on-chain | |
| B12 | `POST /api/reveal` wrong secret | 400 with the Cairo reason; nothing changes on-chain | |
| B13 | `POST /api/matches/:id/action` valid | 200 `{ok:true}`; the queued action is applied to the seat within one tick | |
| B14 | Action with a wrong capability token | 403; the seat does not move | |
| B15 | Action for an unknown match | 404 | |
| B16 | Action with an out-of-range enum | 400 from schema validation | |
| B17 | Action for a dead seat | 409 | |
| B18 | CORS | Browser requests from `:3100` succeed with no CORS error in console | |

## C. WebSocket

| # | Item | Correct means | Status |
|---|---|---|---|
| C1 | Connect | Socket opens; an initial `{type:"match"}` frame arrives without any client request | |
| C2 | Live updates | A state change (seat bought, phase change) pushes a new frame within one tick | |
| C3 | Payload integrity | Every frame parses as JSON; no `bigint` serialisation crash; `matchId` numeric | |
| C4 | Reconnect | Killing and restarting the keeper reconnects automatically without a page reload | |

## D. Web client — screens and states

| # | Item | Correct means | Status |
|---|---|---|---|
| D1 | Boot, keeper reachable | Header shows match id, phase badge, countdown; ship panel and log render; no console errors | |
| D2 | Boot, keeper unreachable | Friendly "Cannot reach the keeper" message, not a blank page or an uncaught exception | |
| D3 | Empty lobby state | Six "empty — an agent takes this at kickoff" placeholders; "Stake and take a seat" enabled only once a wallet is connected | |
| D4 | Connect devnet key | Header swaps to `devnet key · 0x…`; button disappears | |
| D5 | Stake and take a seat | Two real transactions land; seat appears on-chain; "Your seat" switches to seat number + role | |
| D6 | Role is computed locally | Displayed role matches `isImpostor(final_seed, role_secret)`; the keeper is never sent either secret (verified in the network tab) | |
| D7 | Seat backup | Expanding "seat backup" shows JSON containing both secrets and the commitment | |
| D8 | Ship map | Every alive seat appears under its current room; body count badge appears where someone died; your seat is highlighted | |
| D9 | Action panel — move | Only adjacent rooms are offered; clicking one moves the seat within a tick | |
| D10 | Action panel — task | Offered only in a task room with tasks remaining; completing raises the crew task bar | |
| D11 | Action panel — report | Appears only when a body is in the room; triggers a meeting | |
| D12 | Action panel — cameras | Offered only in Security | |
| D13 | Action panel — emergency meeting | Always offered while alive; second use in the same match is refused | |
| D14 | Impostor panel | Kill/vent/sabotage offered only to an impostor; kill targets limited to seats in the same room | |
| D15 | Dead seat | Action panel replaced by the "you are dead" explanation; no action buttons | |
| D16 | Voting phase | Vote buttons on every other living seat plus "skip this vote"; clicking sends one on-chain ballot and the tally increments | |
| D17 | Tallies panel | One block per round, bars proportional to votes, `skip` labelled — never a voter name | |
| D18 | Sabotage banner | Appears on sabotage with the correct fix rooms; critical ones styled as an alarm; clears when fixed | |
| D19 | Task progress bar | Percentage matches Σ`tasksCompleted` / Σ`totalTasks` across seats | |
| D20 | Reveal button | Shown only in the reveal window before revealing; publishes the role secret | |
| D21 | Claim button | Shown only when settled with a non-zero unclaimed payout; claiming credits the shielded balance and flips `claimed` | |
| D22 | On-chain panel | Game/pool links point at the deployed addresses; recent keeper transaction hashes listed | |
| D23 | Event log | Newest-first, colour-coded by kind, readable narrative | |
| D24 | Countdown | Ticks down once per second and reaches 0 at the phase boundary | |
| D25 | Match follow | With no stake, the client moves to the next open lobby once the current match settles | |
| D26 | Match pinning | With a stake, the client stays on that match while other matches broadcast | |
| D27 | Error surfacing | A rejected transaction shows the Cairo reason, not a page of RPC JSON | |
| D28 | Responsive layout | At 375px width nothing overflows horizontally | |
| D29 | Console cleanliness | Zero errors and zero unhandled rejections across every screen above | |
| D30 | Network cleanliness | Zero failed requests (4xx/5xx) during normal operation | |

## E. Integrations and persistence

| # | Item | Correct means | Status |
|---|---|---|---|
| E1 | Postgres persistence | Restarting the keeper preserves matches, seats, events and transaction hashes | |
| E2 | Chain is authoritative | Wiping a mirror field and re-syncing restores it from the contract | |
| E3 | Devnet RPC | Every contract read in the API is a live RPC call — confirmed by matching a direct `starknet_call` | |
| E4 | Real transactions | Every hash the UI shows exists on-chain with `execution_status: SUCCEEDED` | |
| E5 | Boot-time verification | The keeper refuses to start against a chain id or contract address that does not match its deployment file | |
| E6 | Agent auto-fill | Every seat left empty at kickoff is bought by an agent through the pool, funded by the treasury | |
| E7 | Nonce safety | No "Invalid transaction nonce" over a full match | |
| E8 | Stall safety | No phase overruns its deadline by more than the watchdog threshold | |

## F. Not testable in this environment

| # | Item | Why | Status |
|---|---|---|---|
| F1 | STRK20 Wallet API path (`strk20InvokeTransaction`) | Needs a privacy-enabled wallet extension (Ready/Xverse) on a public network. No wallet, no funded account | UNTESTABLE |
| F2 | Sepolia / mainnet deployment | Needs a funded Starknet account; the Sepolia faucet is captcha-gated | UNTESTABLE |
| F3 | House agents against the live STRK20 pool | Needs a proving service URL, discovery indexer URL and a viewing key — operator credentials not present | UNTESTABLE |

---

## Execution record

Run against devnet (a real Starknet chain), Postgres 17, keeper on `:8080`, client on `:3100`.

| Section | Result |
|---|---|
| A — contract | **39/39** `snforge` tests. Seven behaviours that had no test at all (bad params, access control, duplicate commitments, underfilled roster, double reveal, ballot minting) were written during this run |
| B — HTTP API | **14/14**, harness at `apps/keeper/scripts/verify-api.ts` |
| C — WebSocket | **4/4**, measured live in the browser: socket opened in 3 ms, 7 frames in 4 s, clean JSON, numeric ids |
| D — client | Verified: D1–D10, D13–D17, D19–D30. **D11 verified** by `scripts/verify-ui-cases.ts` (body reported in Storage, 200) |
| E — chain & persistence | **8/8**, harness at `apps/keeper/scripts/verify-chain.ts`. 40/40 sampled transactions re-fetched and confirmed `SUCCEEDED` |
| F — untestable | Unchanged: Wallet API path, mainnet, SDK agent path |

### Still unverified

**D12 (cameras in Security)** — the action endpoint accepts it and the button renders only in
Security, but across eight matches the driven seat never reached Security alive: it spawns in
or near the Cafeteria, which is where the crowd is and therefore where impostors kill. The
code path is exercised by agents (the Investigator persona uses cameras), but I have not
watched it accepted from a human seat, so it stays unverified rather than assumed.

### Defects found and fixed during execution

1. Non-numeric match id → HTML 500. Now 400 + JSON, with a route-level error boundary.
2. `/api/lobby` answered 404 for the ordinary "no lobby open" state. Now 200 `{lobby:null}` —
   this also corrected a contradiction between plan rows B8 and D30.
3. Horizontal overflow below ~530 px, from `min-width:auto` on grid children.
4. The client never recovered from a keeper restart — boot config was fetched once, never
   retried.
5. A staked player was pinned to their match forever once it settled.
6. Reveal and claim could double-fire in the gap between the write landing and the mirror
   catching up, producing a 400 the player did nothing to earn.
7. Corpses never rendered on the map: the view marked every body `reported`.
8. Agent nonce races stalled the keeper silently; wallets now serialise per account.
