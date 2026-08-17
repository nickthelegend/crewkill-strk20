# Deploying to Sepolia and mainnet

The contracts are network-agnostic. The only thing that changes is which privacy pool they
are pinned to, and both live pool addresses are already in
[`packages/protocol/src/networks.ts`](../packages/protocol/src/networks.ts), verified against
the chain with `starknet_getClassHashAt`.

## What you need that this repository cannot contain

1. **A funded Starknet account.** The repo ships no keys and no seed phrase. Deploying costs
   gas; on mainnet it costs real STRK.
2. **For house agents on a real pool:** a proving service URL, a discovery indexer URL and a
   viewing key. Those are operator credentials for the STRK20 Privacy SDK. Without them the
   keeper disables agents at boot and logs why — human seats still work end to end through
   the player's own privacy wallet, which needs none of this.

Sepolia STRK comes from a captcha-gated faucet, so funding is a human step. There is no
programmatic route.

## Sepolia

```bash
export NETWORK=sepolia
export KEEPER_ADDRESS=0x…
export KEEPER_PRIVATE_KEY=0x…

pnpm cairo:build
pnpm --filter @crewkill/keeper deploy:contracts     # writes deployments/sepolia.json
```

The deploy script refuses to run against an address with no contract at it, and the keeper
re-checks the chain id and both contract classes at boot — a deployment file is a claim, not
evidence.

Then:

```bash
cd apps/keeper && pnpm prisma:migrate && pnpm dev
cd apps/web && NEXT_PUBLIC_API_URL=https://your-keeper pnpm dev
```

On a real pool the client switches to the STRK20 Wallet API automatically: it asks the user's
privacy wallet for `strk20InvokeTransaction` and never sees a viewing key. Ready and Xverse
support Wallet API ≥ 0.10.3; the client detects capability with a version query rather than
by probing a balance method, because balance reads are gated behind a consent prompt the app
has no reason to trigger.

## Mainnet

Identical, with `NETWORK=mainnet`. This spends real STRK — treat it as a deliberate, human-run
step, not something a script does on your behalf.

Two things to set before real money moves:

- **`stakeAmount`.** The keeper's default for a real network is 0.1 STRK per seat
  (`defaultStake` in `apps/keeper/src/game/engine.ts`). Set it consciously.
- **The pool fee.** Every private action costs a flat fee on top of the stake — 4 STRK on
  mainnet when this was written. Read it from the pool's `get_fee_amount`; do not hardcode.
  A full match is `2 + rounds` private actions per player, so the fee, not the stake, is what
  sets the floor on a sensible buy-in.

## After deploying

Fill in [`strk20.json`](../strk20.json) at the repo root: the hackathon hub reads it, and
each transaction hash is checked against the chain for existence, success, and having touched
the STRK20 pool.

```json
{
  "transactions": ["0x…", "0x…", "0x…"],
  "contracts": ["0x…"],
  "demo_video": "https://…",
  "demo_url": "https://…"
}
```

The three qualifying hashes come out of one match: a seat purchase, a ballot, and a claim —
all three are pool invocations against the CrewKill anonymizer.
