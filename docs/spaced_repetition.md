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

Shots without any assessment are treated as **unassessed** — a distinct category above all scored shots in priority.

**Implementation:** `computeAggregate()` in `src/lib/scoring.ts`

---

## Scheduling Interval

The review interval combines skill score and real-world frequency. High-frequency shots get tighter intervals at every skill level:

| Score | Freq 3 (High) | Freq 2 (Medium) | Freq 1 (Low) |
|-------|---------------|-----------------|---------------|
| **1** (weakest) | Every session | Every session | Every 2 sessions |
| **2** (developing) | Every 2 sessions | Every 3 sessions | Every 4 sessions |
| **3** (proficient) | Every 3 sessions | Every 5 sessions | Every 7 sessions |

A shot is **due** for session N if `(N - 1) % period === 0`.

```
basePeriod = [1, 2, 4]   // indexed by score - 1
freqScale  = [2.0, 1.0, 0.5]  // indexed by 3 - frequency

period = max(1, round(basePeriod[score - 1] * freqScale[3 - frequency]))
```

This means a proficient high-frequency shot still appears every 3 sessions, while a proficient rare shot can go 7 sessions between reviews.

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
[Warmup]  →  [Core blocks × N shots]  →  [Reinforcement for weak shots]  →  [Cooldown]
```

### Parameters

| Parameter | Value |
|-----------|-------|
| Warmup | 10 min (scales down for short sessions) |
| Cooldown | 10 min (scales down for short sessions) |
| Target block length | 15 min |
| Shots per session | `max(2, floor(practiceMinutes / 20))` |
| Shots per minute | 2 (rep rate estimate) |

A 90-min session (70 min practice) schedules 3–4 shots.
A 60-min session (40 min practice) schedules 2 shots.

### Block duration scales with frequency

High-frequency shots get proportionally longer blocks:

```
blockMinutes = targetBlock * (0.8 + frequency * 0.2)
```

- Freq 1 → 15 min
- Freq 2 → 18 min
- Freq 3 → 21 min

### Reinforcement

Reinforcement blocks (a second pass on the same shot) are only added for **score-1 shots** when time permits. Score-2 and score-3 shots get a single core block. This frees up session time for more variety.

### Block types

| Type | Purpose |
|------|---------|
| `warmup` | Loosen arm, calibrate cue-ball control, rehearse pre-shot routine |
| `core` | Primary repetitions — building consistency |
| `reinforcement` | Second pass under fatigue — only for score-1 shots |
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

**Session plan:**
```
Warmup: 10 min
Core: Cross-side bank — 21 min (freq 3 bonus)
Core: Thin cut to corner — 21 min (freq 3 bonus, + reinforcement since score 1)
Core: Stun to center — 18 min (freq 2)
Cooldown: 10 min
```

Remaining ~11 min would go to reinforcement of "Thin cut to corner" (the score-1 shot).

Next session (#6), "Cross-side bank" will have an assessment and enter the normal rotation. "Thin cut to corner" is due again (score 1, freq 3 = every session). "Stun to center" is due again (score 1, freq 2 = every session). "Rail cut" isn't due until session 7 (score 2, freq 3 = every 2 sessions).
