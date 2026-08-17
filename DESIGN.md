# CrewKill design system

The visual direction, and the reasoning behind it, so the next change extends it instead
of drifting from it.

---

## Where this lives

CrewKill sits at **crewkill.molfi.fun**, one game on the molfi.fun hub. The hub bar is the
thinnest thing on the page on purpose: it is wayfinding, not navigation. The game is the
product, and chrome that competes with it for attention is worse than none.

Games that are not open yet are labelled rather than linked. A dead link in the chrome is
worse than an honest "soon".

## Design read

> A live staked social-deduction game for crypto-literate players, with a tactical-telemetry
> language, leaning toward native CSS, Archivo Black macro type and JetBrains Mono telemetry,
> dark-primary with a newsprint light substrate.

**Mode:** redesign, overhaul on visuals, preserve on IA and copy. Routes, nav labels, section
names and copy voice are unchanged. Only the visual language moved.

**Dials.** The existing interface read as `VARIANCE 3 / MOTION 3 / DENSITY 6`: twenty-four
identical bordered boxes, almost no motion, genuinely dense data. Target is
`VARIANCE 7 / MOTION 5 / DENSITY 7`. Density goes *up*, not down. This is a cockpit; a player
mid-meeting wants more instrument on screen, not more whitespace.

**Archetype:** industrial-brutalist §2.2, tactical telemetry. Committed, not blended. No soft
direction, no editorial minimalism.

---

## Why this direction

The product is a game about surveillance, sabotage and reading people, settled on-chain. The
previous interface dressed that as a fintech dashboard: rounded translucent cards, a uniform
label on every box, one sans-serif doing all the work. It looked like software for managing
the game rather than the game itself.

Tactical telemetry is the honest fit. A mission console for a ship that is currently being
sabotaged. Rigid grid, mono readouts, corner brackets, mechanical switches, no rounded
corners anywhere.

---

## Two substrates, one console

Not light mode and dark mode. The same instrument rendered on two media.

| | Phosphor | Newsprint |
| --- | --- | --- |
| Ground | `#0c0e15` | `#e8e5dd` |
| Ink | `#dee5f2` | `#16150f` |
| Rule | `#1c2130` | `#c3bfb4` |
| Crew / confirmed | `#47c97e` | `#1c6f3d` |
| Impostor / fault | `#e8484f` | `#b1272e` |
| Value | `#dfa63b` | `#8a5d09` |
| You / focus | `#46bfdd` | `#0d5c72` |

Structure is identical in both: same grid, same type, same brackets, same density. Only the
substrate inverts. Instrument colours are re-picked per substrate rather than reused, so they
hold contrast on paper instead of glowing off it.

The ship map follows the substrate too. On paper it becomes a printed schematic rather than a
window into space, because a near-black rectangle on newsprint is a section flipping theme
mid-page.

Selection persists in `localStorage` under `crewkill.substrate` and is applied by an inline
script before first paint, so a player who chose paper never sees a black flash.

---

## Type

Two extremes, nothing in between. The gap *is* the hierarchy.

- **Macro** - Archivo Black, uppercase, `-0.045em` tracking, `0.86` leading. Fluid via
  `clamp()`. Classes: `.macro-xl`, `.macro-lg`, `.macro-sm`.
- **Telemetry** - JetBrains Mono at 13px for all body and data. `.numeric` adds tabular
  figures so columns of amounts line up.
- **Labels** - `.tele`, 10px, `0.14em` tracking, uppercase. One label style for the whole
  system. The audit found twelve near-identical ad-hoc versions; they are consolidated.

No third size tier. A dashboard with six slightly different sans-serif sizes is what this
direction exists to avoid.

---

## Structure

Three weights, so a glance can rank what it is looking at. `<Panel weight="…">`.

| Weight | Treatment | Used for |
| --- | --- | --- |
| `primary` | Filled plate, hairline border, corner brackets | The ship, your seat |
| `rail` | Top rule only, no fill, no brackets | Pot, ballots, log, on-chain, privacy, verify |
| `inline` | No chrome | Readouts inside another frame |

**Shape lock: zero radius.** No `rounded-*` anywhere in the chrome. Verified mechanically.

---

## Motion

`MOTION_INTENSITY 5`. Every animation reports state; nothing loops for decoration.

| Animation | Reports |
| --- | --- |
| `.crew-walk` | A crewmate is moving |
| `.room-alarm` | This room is sabotaged |
| `.live-dot` | The socket is connected |
| `.ballot-flip` | A round's result just arrived |

Stepped easing (`steps()`) rather than smooth curves, because mechanical instruments snap.
All four are disabled under `prefers-reduced-motion`.

`.ballot-flip` uses `backwards` fill, never `both`, so a vote result keeps its visible end
state if the animation never runs. A result is information; motion is a flourish on top of
it and must never gate visibility.

---

## What the audit preserved

Not everything was broken. These were kept deliberately:

- **The ship renderer.** Data-driven from `ShipMap`, distinctive, and the best thing in the
  product. Only its backdrop and overlay chrome were made substrate-aware.
- **Crewmate sprites and colour identity.** Seat colour is a gameplay signal.
- **Colour semantics.** Cyan is you, red is impostor, amber is value, green is confirmed.
  The hues were re-picked per substrate; the meanings did not move.
- **Copy voice.** Specific and honest, never marketing-speak. Untouched apart from removing
  banned punctuation.
- **Information architecture.** Same routes, same section names.

---

## What the audit retired

Measured before and after, not judged by eye:

| Tell | Before | After |
| --- | --- | --- |
| Em-dashes | 42 | 0 |
| Middle dots | 18 | 0 |
| Ad-hoc uppercase label styles | 15 | 4 |
| Identical bordered boxes | 24 | 3 weights |
| Hardcoded `bg-black` | 5 | 0 |
| Rounded corners in chrome | 13 | 0 |
| Light substrate | none | full parity |

Also removed: translucent `backdrop-blur` cards, the pill-shaped phase badge, and the
decorative starfield. The one remaining status dot stays because it reports real socket
state, which §9.F permits.

---

## Rules for the next change

1. New surface: pick a weight from the three. Do not invent a fourth.
2. New label: use `.tele`. Do not write another `uppercase tracking-[…]`.
3. New colour: add it to both substrates or do not add it.
4. No em-dash, in any string, anywhere.
5. No rounded corners in chrome.
6. New animation: name the state it reports, or do not ship it.
7. Reach for a component library only if the brief changes. This is native CSS on purpose;
   there is no design system whose defaults look like a ship console.


## Anti-pattern detector

The Impeccable detector runs over `apps` and `packages` and returns zero findings. What it
caught and what was done:

| Finding | Fix |
| --- | --- |
| Two-axis grid background on the page | Removed. The grid now exists only behind the ship, where it is describing a hull rather than decorating a document. |
| Thick coloured side borders on cards (x2) | The legacy renderer that held them was dead code, imported nowhere. Deleted, 3,433 lines. |
| Accent border on a rounded card | Same file, same deletion. |
| Indigo gradient palette | Same file, same deletion. |

Nothing was suppressed. Re-run it with:

```bash
npx impeccable detect apps packages
```

See PRODUCT.md for the full anti-reference list this project is held to.
