# The CrewKill protocol

Everything that decides money is here. If a rule is not in this document and in
[`cairo/src/crewkill.cairo`](../cairo/src/crewkill.cairo), it does not decide anything.

## Vocabulary

| Term | Meaning |
| --- | --- |
| `role_secret` | Chosen by the player. Decides their role. Published at the end of the match. |
| `claim_secret` | Chosen by the player. Gates the payout. **Never** published. |
| `claim_commitment` | `poseidon(CLAIM_TAG, claim_secret)` |
| `seat_commitment` | `poseidon(SEAT_TAG, role_secret, claim_commitment)` — the public identity of a seat |
| `operator_seed` | The operator's half of the role randomness |
| `seed_commitment` | `poseidon(OPSEED_TAG, operator_seed)`, fixed before the lobby opens |
| `final_seed` | `poseidon(operator_seed, c₀, c₁, …, cₙ)` over every seat commitment in seat order |
| ballot note | One `CKBALLOT`, spent through the pool to cast a vote or a night action |

Two secrets rather than one is the load-bearing detail. The role secret has to become public
for the match to be auditable; if it also controlled the money, publishing it would let anyone
steal the payout. Splitting them means a reveal proves your role and proves nothing about your
claim.

## Lifecycle

```
create_match ──► [Lobby] ──► start_match ──► [Playing] ──► end_play ──► [Revealing] ──► settle ──► [Settled]
                    │                                                                                 │
                    └────────────────────── abort_match ──► [Aborted] ─────────────────────────────► claim
```

### 1. Lobby

`create_match(stake, seats, rounds, impostor_bps, detective_bps, protocol_bps, seed_commitment)`.
The operator's seed is committed here, **before it has seen a single player**.

A player buys a seat with one pool transaction:

```
pool withdraws `stake` to CrewKill
  → privacy_invoke(JoinSeat, match_id, seat_commitment, …, note_id)
  → CrewKill checks the balance delta equals `stake` exactly
  → registers the seat, mints `rounds` ballot notes, approves the pool
  → returns [OpenNoteDeposit{ note_id, CKBALLOT, rounds }]
```

The stake is measured as a balance delta rather than trusted from calldata, because calldata
is the attacker's to write. No address is recorded, and the `SeatBought` event deliberately
carries none.

Whatever seats humans leave, the keeper fills with house agents at kickoff — buying them the
same way, through the pool, funded from the treasury. Agents that took the keeper-only
`fill_agent_seat` shortcut would receive no ballot notes and could not vote, which is a
useful accident: it forces agents down the same path as everybody else.

### 2. Roles

`start_match(match_id, operator_seed)` verifies the pre-commitment and fixes

```
final_seed = poseidon(operator_seed, c₀ … cₙ)
```

A seat is an impostor iff

```
poseidon(DRAW_TAG, final_seed, role_secret) mod 10000 < impostor_bps
```

Three properties fall out:

- **The operator cannot bias it.** Its seed was committed before it saw any commitment, and
  `start_match` re-checks the hash. Swapping seeds reverts (`CK: seed mismatch`).
- **Players cannot grind it.** Their commitment is fixed before `final_seed` exists.
- **Nobody can read anyone else's role**, because the draw needs `role_secret`. This is the
  part a server-authoritative design cannot have.

The count of impostors is a binomial draw, not a constant. A match with none is a legitimate
outcome — the crew wins by default, and it plays to full length so the twist is not announced
by an early finish.

### 3. Play

Rounds alternate **night → meeting → voting**. Starknet has no timers, so the keeper owns the
clock; it cannot do anything else.

Both night actions and votes are ballot spends:

```
pool withdraws 1 CKBALLOT to CrewKill
  → privacy_invoke(CastBallot, match_id, commitment, kind, round, target, …)
  → CrewKill checks a ballot really arrived, burns it, records the result
  → returns [] (an empty span is valid: credit nothing)
```

| Kind | `commitment` | Effect |
| --- | --- | --- |
| Vote | `poseidon(VOTE_TAG, role_secret, round, target)` | `tally[round][target] += 1` |
| Kill | `poseidon(KILL_TAG, role_secret, round, victim)` | records a night action against `victim` |

The commitment doubles as the replay nullifier and as the receipt the Detective Pool later
pays against. It is stored keyed by its own hash, so the table itself links nothing to a seat.

Night actions are **not** validated at submission time — the contract cannot tell who spent
the ballot, which is the point. Validity is settled later and enforced with money.

Between meetings the ship runs its own game — movement across the Skeld's room graph, tasks
that take two rounds each, vents, cameras, and four kinds of sabotage — driven by the keeper
and described in [`apps/keeper/src/game/world.ts`](../apps/keeper/src/game/world.ts). None of
it is on-chain: it is what a meeting argues *about*, not what decides money. Opening
positions and task assignments do come from `final_seed`, so the starting spread is as
unbiasable as the roles.

The contract does not check that a kill was plausible — it cannot see who the killer was.
It only records that a night action was claimed, and settles the question later.

### 4. Reveal

`reveal_seat(match_id, role_secret, claim_commitment)` is permissionless — knowledge of the
secret *is* the authorisation. Publishing it exposes your role and every ballot you cast, and
nothing about your wallet.

Revealing is a precondition for being paid, so it is incentive-compatible. A seat that never
reveals forfeits its stake into the pot and is counted as crew.

### 5. Settlement

`settle(match_id)` is permissionless and recomputes the entire match from chain state:

1. **Validate night actions.** A kill counts only if some revealed impostor's secret
   reproduces its commitment.
2. **Replay eliminations.** Round by round: night actions land, then the meeting ejects
   whoever the tally singles out. A tie, an empty tally, or a skip majority ejects nobody.
   *Every* claimed kill is applied, valid or not — the engine could not tell at the time
   either, and pretending otherwise would make the replay diverge from what players saw.
3. **Win condition.** The crew wins iff no impostor is alive at the end.
4. **Detective Pool.** For each revealed seat, each round, each impostor: if the receipt
   `poseidon(VOTE_TAG, role_secret, round, impostor)` exists, add weight
   `rounds_played − round + 1`. Earlier reads are worth more.
5. **Split.**
   ```
   fee       = pot × protocol_bps / 10000
   detective = pot × detective_bps / 10000     (zero if nobody read it right)
   main      = pot − fee − detective
   payout    = (winner ? main / winners : 0) + (weight ? detective × weight / total : 0)
   ```

Eligible for the main pot: revealed, on the winning side, and not a proven bluffer. Everything
not paid out — rounding dust, forfeited stakes, the whole main pot if nobody qualifies —
becomes protocol fees, so nothing is stranded in an unreachable state. The Cairo test
`a_seat_that_never_reveals_forfeits_its_stake` asserts exactly that the books balance.

### 6. Claim

```
privacy_invoke(Claim, match_id, …, claim_secret, note_id)
  → CrewKill finds the seat whose published claim_commitment matches
  → approves the pool, returns [OpenNoteDeposit{ note_id, STRK, payout }]
```

The money lands in a shielded note. The role secret is public by now and is useless here —
`the_role_secret_alone_cannot_move_the_money` is the test for that.

## Aborts

`abort_match` sets every seat's payout to its full stake, takes no fee, and opens claims.
Used when a lobby cannot be staffed, or when a keeper restart loses the operator seed for a
lobby that never started — the stakes go back rather than sitting stranded.

## Threat notes

| Attack | What stops it |
| --- | --- |
| Calling `privacy_invoke` directly to get a free seat | Caller must be the pinned pool (`CK: caller not pool`) |
| Understaking | Balance-delta check (`CK: stake mismatch`) |
| Voting without a ballot | Ballot-arrival check (`CK: ballot mismatch`) |
| Replaying a ballot | Receipt hash is a one-time nullifier (`CK: replayed commitment`) |
| Operator rigging roles after seeing the lobby | Seed pre-commitment (`CK: seed mismatch`) |
| Stealing a payout with a published role secret | Claim secret is separate and never published |
| A crewmate faking a night action | Detected at settlement; the bluffer forfeits their stake |
| Vote buying | Ballots are unattributable, so a bribe cannot be verified |
| A lobby nobody joins | Agent auto-fill; the match runs regardless |

## Costs

Each pool action carries a flat protocol fee (4 STRK on mainnet when this was written; read
it from the pool's `get_fee_amount` rather than hardcoding). A seat is one action, each ballot
is one, and a claim is one — so a full match is `2 + rounds` private actions per player. That
is the real cost of unattributable voting on STRK20 today, and it is why the devnet path
exists: full matches, free, same contracts.
