# What is in `_references/`, and what it is worth here

## mental-poker

Trustless multiplayer card games with provable privacy. Noir circuits proved in the browser,
verified on-chain in Cairo through Garaga. Built for the Starknet Re{define} privacy track,
with a working Texas Hold'em example and a live Sepolia deployment.

Roughly 82,000 lines. The parts that matter:

| Piece | What it is |
| --- | --- |
| `sdk/src/crypto/elgamal.ts` | Threshold ElGamal: aggregate key, reveal tokens, decrypt-with-tokens |
| `circuits/` | Noir circuits for shuffle and reveal |
| `contracts/` | Cairo verifiers, generated via Garaga |
| `sdk/src/texas-holdem-sdk.ts` | The game layer on top of the protocol |
| `examples/poker-multiplayer/` | Vite + React client |

### Ported: the threshold cryptography

`packages/mental-poker` carries the Grumpkin curve operations and the threshold ElGamal
across verbatim, with eight tests written to break the claim rather than demonstrate it: a
single player acting alone, a missing token, a substituted key, and remasking as a shuffle
would. `apps/poker` runs it live in the browser.

What did not come across is the proving layer. The reference proves its shuffles in Noir and
verifies them on-chain through Garaga. Without that, the reveal is real and the shuffle is
unproved, and the poker page says exactly that rather than letting a visitor assume
otherwise.

### Still worth taking, not yet taken

CrewKill's README names its own worst weakness:

> The keeper knows the roles of agent seats, because it generated their secrets.

That is exactly the problem threshold ElGamal solves. In mental-poker no single party can
decrypt a card: every player contributes to an aggregate key, and a card only opens when
enough of them publish reveal tokens. Applied to CrewKill, agent role secrets would be
generated collaboratively rather than by the keeper, and the residual risk that currently has
to be written down as an apology would stop existing.

That is a protocol change, not a port. It touches the role draw, the reveal window, the
settlement path and the Cairo contract, and it needs the Noir toolchain and a Garaga-generated
verifier. It is the right next piece of work and it is deliberately not started here, because
half of it is worse than none: a partially rewritten role draw would break settlement, which
is the part of CrewKill that currently works.

### Not worth porting

- **The poker game itself.** Poker lives at `poker.molfi.fun` as its own product. Pulling
  Texas Hold'em into CrewKill would make both worse.
- **The client.** Vite + React with its own visual language. CrewKill has a committed design
  system documented in `DESIGN.md`, and grafting another project's UI in would undo it.
- **Garaga verifier contracts** as they stand. They verify shuffle and reveal proofs for a
  card deck. CrewKill has no deck.

### Also worth reading, separately from porting

The architecture document is a clear write-up of an n-of-n threshold scheme, and the way it
splits "prove in the browser, verify on-chain" is the same shape CrewKill uses for role
secrets. Useful as a reference even where the code is not.
