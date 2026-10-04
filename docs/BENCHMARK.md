# Benchmark: five student requests from a fresh clone

The sandbox exists so that a student's first request needs no decisions about stack, device or
structure. This benchmark measures that. `npm run benchmark` clones the repo to a temp folder,
runs Claude Code non-interactively with one request, records tokens, cost, time, turns and which
files it read, then type-checks and boot-tests the result. Each run costs real tokens; run it at
milestone ends.

Requests
1. Put a small blue cube on the table in front of me.
2. Make the cube draggable.
3. Add a label above the cube that says 'Cube'.
4. When I tap the cube, the AI should say 'Nice choice' (fake is fine).
5. When I say 'hello', show a panel that says 'Hello back'.

Acceptance: every request passes `npm run check` and the boot smoke test; no clarifying question;
under 4 minutes; under 60 k new input tokens plus cache writes (cache *reads* are the system prompt
and earlier turns replayed per turn and are reported separately); median zero reads outside
`src/experience/`, `CAPABILITIES.md` and `CLAUDE.md`. A clarifying question about technology is a
defect in the sandbox, not in the student.

Cost per request is what the Claude CLI reports (`total_cost_usd`), at the model and prices of the day.

## Runs

### 2026-10-03 · 0da9c23

| # | Request | New input | Cache write | Cache read | Output | Cost | Time | Turns | Reads outside | Asked a question | check | boot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Put a small blue cube on the table in front of me. | 8 | 32565 | 87323 | 1699 | $0.290 | 34s | 5 | 0 | no | ✓ | ✓ |
| 2 | Make the cube draggable. | 4 | 19724 | 35168 | 966 | $0.165 | 20s | 3 | 0 | no | ✓ | ✓ |
| 3 | Add a label above the cube that says 'Cube'. | 8 | 16703 | 90593 | 970 | $0.174 | 23s | 5 | 0 | no | ✓ | ✓ |
| 4 | When I tap the cube, the AI should say 'Nice choice' (fake is fine). | 18 | 20201 | 236757 | 3211 | $0.325 | 115s | 12 | 1 (test/smoke/starter.spec.ts) | no | ✓ | ✓ |
| 5 | When I say 'hello', show a panel that says 'Hello back'. | 24 | 32314 | 403768 | 6225 | $0.560 | 158s | 13 | 1 (test/smoke/starter.spec.ts) | no | ✓ | ✓ |

### 2026-10-03 · 071d04b

| # | Request | New input | Cache write | Cache read | Output | Cost | Time | Turns | Reads outside | Asked a question | check | boot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Put a small blue cube on the table in front of me. | 8 | 21401 | 98580 | 2333 | $0.241 | 42s | 6 | 0 | no | ✓ | ✓ |
| 2 | Make the cube draggable. | 12 | 22193 | 161402 | 1403 | $0.255 | 47s | 7 | 2 (draggable|drag, test/smoke/starter.spec.ts) | no | ✓ | ✓ |
| 4 | When I tap the cube, the AI should say 'Nice choice' (fake is fine). | 12 | 15484 | 138508 | 1517 | $0.204 | 35s | 9 | 0 | no | ✓ | ✓ |
