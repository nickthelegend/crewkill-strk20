# Product

Written from the code and copy that already exist, so a later change inherits this instead
of drifting back to defaults.

## What this is

CrewKill is a staked social-deduction game that settles on Starknet. Six seats, four rounds,
one pot. You buy a seat by shielding your stake through the STRK20 privacy pool, so the game
contract records a commitment and never an address.

It lives at **crewkill.molfi.fun**, one game on the **molfi.fun** hub. It is not a standalone
site and should not present itself as one.

## Who uses it

- **Players** who will stake real value on reading other people. Crypto-literate, impatient,
  and rightly suspicious of anything claiming to be private.
- **Judges and onlookers** who arrive mid-match, know nothing, and will decide in about
  fifteen seconds whether this is interesting.

Both need the same thing first: to understand that the privacy is the mechanic, not a
feature bolted onto a game.

## Surfaces and their mode

| Surface | Mode | What it owes the reader |
| --- | --- | --- |
| Landing (lobby) | **Persuade** | The logo, four live numbers, one thing to press. Argument before detail. |
| Console (in play) | **Operate** | The ship owns the screen. Everything else floats and stays out of the way. |
| Meeting table | **Experience** | The tensest moment in the game. It interrupts, and it is worth interrupting for. |
| Archive | **Read** | Evidence. Dense, scannable, linked out to the chain. |
| Primer | **Persuade** | Three cards, then gone. Never twice. |

## Voice

Plain, specific, and willing to say what is not true. The copy states what is public as
readily as what is hidden, because a privacy claim that hides its own limits is worthless.

Never: "seamless", "elevate", "unleash", "next-gen", "revolutionise". No exclamation marks.
No em-dashes anywhere in interface text.

## Visual direction

Tactical telemetry, committed. A mission console for a ship that is currently being
sabotaged, not an admin panel for a fintech product. Two substrates, phosphor and newsprint,
identical in structure.

See DESIGN.md for tokens, type, structure and motion.

## Anti-references

Things this product must never look like. Every one of these was either present and removed,
or deliberately declined.

- **Page-wide grid or line-field backgrounds.** Removed. A grid belongs on the ship, where
  it describes something, not behind the whole document.
- **Purple and violet gradients, cyan-on-dark glow.** The palette is desaturated and
  substrate-driven.
- **Glassmorphism.** No frosted panels. Surfaces are opaque plate or nothing.
- **Rounded cards.** Zero radius anywhere in the chrome.
- **Thick coloured side borders on cards.** Removed with the legacy renderer.
- **Nested cards.** Three structural weights, and they do not stack inside each other.
- **Uniform bordered boxes for everything.** The original had twenty-four; framing everything
  the same way means nothing is framed.
- **Numbered section labels.** No `01 / OVERVIEW` eyebrows.
- **Decorative pulsing dots.** One remains, and it reports real socket state.
- **Generic drop shadows.** None. Depth comes from rules and brackets.
- **Italic serif hero.** No serif at all; two extremes of sans and mono.
- **Side-tab navigation.** The hub bar is one horizontal line.
- **Em-dashes as a design element.** Banned in interface text, mechanically checked.
- **Invented metrics.** The landing counts real matches. There is no lobby server, so there
  is no "players online" number, and inventing one would poison everything after it.

## What must not change silently

- Route slugs (`/`, `/history`) and the hub bar's links.
- The colour semantics: cyan is you, red is impostor or fault, amber is value, green is
  confirmed.
- The honesty of the privacy copy. If a limitation stops being stated, the pitch is a lie.
