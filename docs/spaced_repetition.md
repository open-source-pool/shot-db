# Spaced Repetition Algorithm

## Overview

ShotDB uses a spaced repetition system to decide which shots to include in each training session. The system balances three goals:

1. **Cover the full library** — every shot should get practiced regularly
2. **Focus on weakness** — weaker shots appear more often than strong ones
3. **Prioritize real-world frequency** — shots that come up more often in play deserve more training time

---

## Assessment Scoring

Each shot is periodically assessed across five dimensions:

| Dimension | Scale | Description |
|-----------|-------|-------------|
| Comfort level | 1–4 | How comfortable the player feels with the shot |
| Visualization | 1–4 | Ability to visualize the shot before execution |
| Beautiful stroke | yes/no | Was the stroke mechanically sound? |
| Alignment correct | yes/no | Was stance and eye line correct? |
| Result | 1–2 | Outcome quality (1 = not good, 2 = good) |

These produce an **aggregate score** (1, 2, or 3):

```
comfort = 1 AND visualization = 1  →  1  (weakest)
stroke = no OR alignment = no      →  2  (mechanics issue)
result = 1                         →  2  (execution issue)
otherwise                          →  3  (proficient)
```

Shots without any assessment are treated as **unassessed** — a distinct category above all scored shots in priority. For scheduling purposes, unassessed shots default to score **2** (developing).

**Implementation:** `computeAggregate()` in `src/lib/scoring.ts`

---

## Scheduling Interval

The review interval combines skill score and real-world frequency. High-frequency shots get tighter intervals at every skill level. Intervals are tuned for sessions of 2–4 shots drawn from a library of ~20 active shots (natural rotation ≈ every 7 sessions):

| Score | Freq 3 (High) | Freq 2 (Medium) | Freq 1 (Low) |
|-------|---------------|-----------------|---------------|
| **1** (weakest) | Every 2 sessions | Every 3 sessions | Every 5 sessions |
| **2** (developing) | Every 4 sessions | Every 5 sessions | Every 8 sessions |
| **3** (proficient) | Every 6 sessions | Every 8 sessions | Every 12 sessions |

A shot is **due** for session N if `(N - 1) % period === 0`.

```
basePeriod = [3, 5, 8]   // indexed by score - 1
freqScale  = [1.5, 1.0, 0.7]  // indexed by 3 - frequency

period = max(1, round(basePeriod[score - 1] * freqScale[3 - frequency]))
```

Score-1 high-frequency shots appear roughly 3× more often than natural rotation, while proficient low-frequency shots can go 12 sessions between reviews. No shot appears every session — even the weakest shots get at least one session gap to allow variety.

**Implementation:** `spacedPeriod()` and `isDueForSession()` in `src/lib/scoring.ts`

---

## Priority Sort

When building a session, shots are sorted into a single priority queue:

### 1. Unassessed shots first

Shots with no assessment record go to the top. Within this group, sort by frequency (high first), then alphabetical. The goal is to get a baseline assessment for every shot before optimizing the schedule.

### 2. Assessed shots by composite priority score

For assessed shots, compute:

```
priorityScore = (4 - score) * 2 + frequency
```

| Score | Freq | Priority | Interpretation |
|-------|------|----------|----------------|
| 1 | 3 | 9 | Weak + common → highest urgency |
| 1 | 2 | 8 | |
| 1 | 1 | 7 | Weak + rare |
| 2 | 3 | 7 | Developing + common (same urgency as weak + rare) |
| 2 | 2 | 6 | |
| 2 | 1 | 5 | |
| 3 | 3 | 5 | Proficient + common (still gets regular practice) |
| 3 | 2 | 4 | |
| 3 | 1 | 3 | Proficient + rare → lowest urgency |

A developing high-frequency shot can outrank a weak low-frequency shot. That's intentional — you should practice common developing shots more than rare weak ones.

### 3. Recency tiebreaker

Within the same priority score, prefer the **least recently practiced** shot (by latest session_block date). Shots never practiced sort highest. This ensures rotation instead of the same shots repeating every session.

### 4. Consecutive appearance cap

If a shot has appeared in 3+ consecutive sessions, subtract 1 from its priority score for sorting. This prevents any single shot from dominating the schedule indefinitely.

### Full sort order

```
1. Unassessed first  (sub-sort: frequency DESC, alpha)
2. Priority score DESC
3. Least recently practiced first  (NULL = top)
4. Alphabetical
```

**Implementation:** `prioritizeShots()` in `src/lib/scoring.ts`

---

## Session Planning

A session is divided into timed blocks. The planner takes a total duration and fills it.

### Structure

```
[Warmup]  →  [Core blocks × N unique shots]  →  [Reinforcement: bonus shot]  →  [Cooldown]
```

**Each shot appears at most once per session.** No shot is ever repeated within the same session plan.

### Parameters

| Parameter | Value |
|-----------|-------|
| Warmup | 10 min (scales down for short sessions) |
| Cooldown | 10 min (scales down for short sessions) |
| Block length | 20 min (fixed) |
| Shots per minute | 2 (rep rate estimate) |

### Filling practice time

Each core shot gets a fixed **20-minute block**. The number of core shots is `floor(practiceMinutes / 20)`. Core blocks draw from the full priority queue (eligible/due shots first, then backfill). If the remaining time after core blocks is not zero (`practiceMinutes % 20`), a single **reinforcement** block fills the remainder with a quick review of the next eligible (due) shot not already in the session. Reinforcement **only** draws from due shots — it never pulls in not-due or backfill shots. If no eligible shot remains, reinforcement is skipped.

| Session | Practice time | Core shots | Reinforcement |
|---------|---------------|------------|---------------|
| 60 min  | 40 min        | 2 × 20    | —             |
| 90 min  | 70 min        | 3 × 20    | 10 min        |
| 120 min | 100 min       | 5 × 20    | —             |

### Block types

| Type | Purpose |
|------|---------|
| `warmup` | Loosen arm, calibrate cue-ball control, rehearse pre-shot routine |
| `core` | Primary repetitions — building consistency |
| `reinforcement` | Quick review of a bonus high-priority shot not already in the session |
| `cooldown` | Stretch, breathing, capture session takeaways |

### Coaching focus hints

Each block gets a focus string generated from the shot's latest assessment:

- Comfort + viz both 1 → "Rehearse picture: pre-shot visualization + aim map"
- Stroke not beautiful → "Emphasize smooth stroke; no decel; hold still"
- Alignment incorrect → "Re-check stance/eye line; ghost-ball to aim"
- Result not good → "Slow pace; commit to line before stroke"
- Everything good → "Groove pattern; confirm cue-ball path"

**Implementation:** `planSession()` in `src/lib/session-planner.ts`, `focusHint()` in `src/lib/scoring.ts`

---

## Session Execution & Tracking

During a session, the player records per-block:

- **Attempts** and **successes** (hit/miss)
- **Shot variation** — which image/setup was practiced (`shot_image_id`)
- **Comfort rating** (1–4, optional)
- **Notes**

This data feeds the recency tiebreaker (last-practiced date) and the session history view on each shot's detail page.

---

## Example

31 active shots, session #5, 90-minute session.

**Scheduling:** With the frequency-adjusted intervals, approximately 12–15 shots are due for session 5. The planner picks the top 3–4 by priority score.

**Priority queue (top entries):**
1. "Cross-side bank" — unassessed, freq 3 → top priority (never seen)
2. "Thin cut to corner" — score 1, freq 3, last practiced session 3 → priority 9
3. "Stun to center" — score 1, freq 2, last practiced session 4 → priority 8
4. "Rail cut" — score 2, freq 3, last practiced session 1 → priority 7

**Session plan (90 min → 70 min practice → 3 × 20 + 10 remainder):**
```
Warmup: 10 min
Core: Cross-side bank — 20 min
Core: Thin cut to corner — 20 min
Core: Stun to center — 20 min
Reinforcement: Rail cut — 10 min (remainder, quick review)
Cooldown: 10 min
```

Each shot appears exactly once. The 10-min remainder goes to a reinforcement block for "Rail cut" — the next highest-priority shot not already in the session.

Next session (#6), "Cross-side bank" will have an assessment and enter the normal rotation. "Thin cut to corner" isn't due until session 7 (score 1, freq 3 = every 2 sessions). "Stun to center" isn't due until session 8 (score 1, freq 2 = every 3 sessions). "Rail cut" isn't due until session 9 (score 2, freq 3 = every 4 sessions).
