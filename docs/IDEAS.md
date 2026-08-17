# 100 ideas, ranked

Scored `impact × feasibility × fit` for the STRK20 Private Sprint, whose panel weights
**30% integration depth · 30% working mainnet product · 25% innovation · 15% docs**.

Fit is the ruthless column. CrewKill's pitch is *"a staked game whose privacy is load-bearing,
not decorative"*. Anything that does not sharpen that gets scored down even if it is fun —
a demo with twenty features and no argument loses to one with six and a thesis.

Status: **BUILT** verified working · **PARTIAL** working with a stated limit ·
**SKIPPED** with the reason · **BLOCKED** on something that does not exist here.

---

## Tier 1 — build first (high impact, strong fit, buildable)

| # | Idea | Why it scores | Status |
|---|---|---|---|
| 1 | **Anonymity-set meter** — live gauge of how identifiable your stake is, from the docs' own "distinctive patterns" warning | Turns a documented STRK20 limitation into a product feature. Nobody else will show they *read* the compliance page | BUILT |
| 2 | **Stake-timing advisory** — the meter scores the gap between shielding and staking, so waiting is rewarded | Directly fixes the linkability the docs warn about | BUILT |
| 3 | **Shield-ahead, as two separate actions** — shielding is its own button and its own transaction | "Deposits are public and name the depositor" — the single highest-value privacy UX act. Verified: the meter moves weak → fair → strong as you do it properly | BUILT |
| 4 | **Ballot disclosure** — recover who voted for whom from published secrets, by checking candidate receipts against the contract | The compliance model in one button: unlinkable while it matters, auditable after. Verified: 137 real on-chain reads recovered every ballot of a settled match, and both impostors' skip-skip-skip pattern is plainly visible | BUILT |
| 5 | **Post-match integrity replay** — recompute roles, tallies and payouts client-side from chain data and show they match | Proves the settlement claim rather than asserting it | BUILT |
| 6 | Sepolia deployment with real transactions | 30% of the score is "working product" | BUILT — game `0x55ac4a11…`, ballot `0x38cea847…`, 4 txs confirmed SUCCEEDED |
| 7 | Mainnet deployment + three pool transactions in `strk20.json` | The literal prize requirement | BLOCKED — real money, user's call |
| 8 | **On-chain ledger** — every transaction with human labels and real explorer links | Makes "this is really on-chain" legible in a 3-minute video. Verified live with 8 transactions | BUILT |
| 9 | **Privacy ledger** — per-seat panel of exactly what is public vs hidden about *you*, right now | The clearest possible articulation of the thesis | BUILT |
| 10 | Demo mode - deterministic seeded match for recording | Removes luck from the demo video | SKIPPED - phase-length env vars already give this |
| 10a | **First-run primer** - three cards teaching what the game is and what is hidden versus public | The largest gap in the whole project. A judge landing mid-match saw a ship and panels and was never told that the privacy is the mechanic. Verified: fires once, three cards, remembered, reopenable | BUILT |

## Tier 2 — strong, build if time

| # | Idea | Notes | Status |
|---|---|---|---|
| 11 | Kill-cam: replay the moment of a kill from the room log | Motion + evidence | SKIPPED — time |
| 12 | **Tally reveal motion** — rows land in sequence when a round's result appears | Motion at the tensest moment. Note: an earlier draft showed "sealed envelopes" during voting, which was withdrawn as **misleading** — counts are public on-chain as ballots land; only authorship is sealed | BUILT |
| 13 | Sabotage screen-shake + klaxon | Ported map already has alarm overlays | PARTIAL — inherited from port |
| 14 | Ejection cutscene (float into space) | Exists in legacy `EventScreens` | PARTIAL — inherited |
| 15 | Detective Pool payout breakdown per seat | Explains the novel mechanic | BUILT |
| 16 | Round-by-round suspicion graph | Shows agent reasoning | SKIPPED — time |
| 17 | Spectator mode with seat-follow camera | Map already supports click-to-follow | PARTIAL — inherited |
| 18 | Agent personality cards on hover | Nice, not load-bearing | SKIPPED |
| 19 | Match history page with outcomes | Persistence proof — 25 matches, 19 settled, openable to a per-seat breakdown | BUILT |
| 20 | Seat-secret export as a file | Money-loss prevention: this is the only thing that can claim a payout, and it lives in one browser. Copy, download and a plain warning. Verified in a live seat | BUILT |
| 21 | "Your ballot is unlinkable" proof panel | Educational | BUILT (folded into #9) |
| 22 | Pool fee display read from `get_fee_amount` | WITHDRAWN — no such entrypoint exists in the STRK20 interface. I invented it when drafting this list; building against it would have meant inventing the value too | WITHDRAWN |
| 23 | Gas/fee estimate before staking | Prevents a failed signature | SKIPPED — devnet fees are meaningless |
| 24 | Multi-match spectating | Clutters the pitch | SKIPPED |
| 25 | Agent win-rate leaderboard | Legacy had `AgentRegistry`; out of scope per brief | SKIPPED |
| 26 | Sound design (ambient hum, alarm, vote chime) | Memorable, but autoplay is hostile | SKIPPED |
| 27 | Keyboard shortcuts for movement | Real UX win for players | SKIPPED — time |
| 28 | Mobile-responsive HUD | Verified no overflow; full mobile play is out of scope | PARTIAL |
| 29 | Reconnect/offline banner | Production-readiness | BUILT |
| 31a | **Deployment card** — the contracts this match settles through, linked to the explorer | "Here is the address" beats "trust us" | BUILT |
| 30 | Empty-state copy everywhere | Production-readiness | BUILT |

## Tier 3 — good ideas, wrong hackathon

31. Prediction markets on matches — explicitly cut by the brief; Veilcast/Kiroshi own that space.
32. CREW token accounting layer — brief says settle in STRK for the MVP.
33. Third-party agent registry with bonding — stretch goal, needs an economic design.
34. NFT trophies for wins — dilutes the privacy pitch.
35. Tournament brackets. 36. Seasons/ranked ladder. 37. Twitch extension.
38. Discord bot. 39. Mobile app. 40. Replay sharing links.
41. Custom lobbies with configurable stakes. 42. Private friend lobbies.
43. Chat between players. 44. Emote system. 45. Cosmetic skins.
46. Referral rewards. 47. Daily quests. 48. Achievement system.
49. Player profiles. 50. Global chat.

*(31–50 all score low on fit: they are game-platform features, not privacy features, and the
panel is scoring privacy depth.)*

## Tier 4 — deeper STRK20 integrations (high ceiling, high cost)

51. **Privacy SDK agent path** — house agents acting through the real pool. BLOCKED: needs a
    proving service URL, discovery indexer and viewing key.
52. Stealth ballot accounts funded by one batched private transfer — the cheapest anonymous
    voting design; needs the SDK's multi-op batch. BLOCKED with #51.
53. Open-note payouts sized at settlement time. BUILT (already how claims work).
54. Sub-account anonymizer for seat identity. SKIPPED — release candidate, unaudited.
55. AVNU private swap to let players stake any token. SKIPPED — scope.
56. Privacy Bridge inbound funding from EVM. SKIPPED — scope.
57. Self-hosted prover. SKIPPED — infrastructure, not product.
58. Threshold auditor key demo. SKIPPED — governance-set, not app-level.
59. `strk20PrepareInvoke` dry-run before every stake. BUILT.
60. Wallet capability detection by version query, not by probing balances. BUILT.
60a. Network-scoped reads, so one chain's matches are never served on another. BUILT — this was a real bug found by pointing the keeper at Sepolia.
61. OHTTP-enabled discovery. BLOCKED with #51.
62. Note-maturity countdown (10 blocks) in the UI. BUILT.
63. `classifyTransaction` history view. SKIPPED — SDK-route only.
64. Paymaster-relayed submission. SKIPPED — needs an API key.
65. Multi-token pots. SKIPPED — scope.

## Tier 5 — design and motion

66. Phase-transition wipes. PARTIAL — inherited from the port.
67. Crewmate walk-cycle bob. BUILT (ported).
68. Corpse discovery flash. PARTIAL — inherited.
69. Lights-out darkness overlay. BUILT.
70. Radar sweep animation on the minimap. PARTIAL — inherited.
71. Countdown urgency (colour shift under 10s). BUILT.
72. Vote-bar fill animation. BUILT.
73. Pot counter roll-up. SKIPPED — time.
74. Seat-claim confirmation moment. SKIPPED — time.
75. Reveal-window dramatic beat. SKIPPED — time.
76. Reduced-motion support. BUILT.
77. Dark/light theming. SKIPPED — the game is night-only by design.
78. Loading skeletons. BUILT.
79. Focus states / keyboard nav. PARTIAL.
80. Screen-reader labelling of the map. BUILT.

## Tier 6 — production-readiness

81. JSON-only API error boundary. BUILT.
82. Non-numeric route param handling. BUILT.
83. Self-healing boot after a keeper restart. BUILT.
84. WebSocket reconnect with backoff. BUILT.
85. Overlapping-request guard on pollers. BUILT.
86. Per-wallet transaction serialisation (nonce safety). BUILT.
87. Stall watchdog on phase progression. BUILT.
88. Double-submit guards on reveal and claim. BUILT.
89. Horizontal-overflow fix at narrow widths. BUILT.
89a. Shipping metadata on both sites: favicon, open graph and Twitter cards, and a branded
    404 with a way back. BUILT. The hub had these from its rebuild and CrewKill did not,
    which is the kind of gap that only shows when someone shares a link.
90. Deployment/chain-id verification at boot. BUILT.
91. Abort-and-refund path for stalled matches. BUILT.
92. Agent account lease pool. BUILT.
93. Bounded waits on every RPC call. BUILT.
94. Test plan with explicit pass criteria. BUILT.
95. API verification harness. BUILT.
96. Chain verification harness. BUILT.
97. Human end-to-end harness. BUILT.
98. Cross-language hash vectors. BUILT.
99. Contract guard-rail test suite. BUILT.
100. Honest residual-risk section in the README. BUILT.

---

## What this ranking rejects, and why

The temptation is to build tiers 3 and 5 because they are visible and cheap. They lose to
tier 1 on **fit**: a panel weighting privacy integration at 30% and innovation at 25% will
reward one feature that proves the anonymity set is real over ten cosmetic flourishes.

The single highest-value item is #7 (mainnet), because it is a hard gate on 30% of the score
and no amount of polish substitutes for it.
