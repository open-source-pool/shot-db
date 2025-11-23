#!/usr/bin/env python3
"""
Pool Training Plan Generator (CLI)

- Reads your assessment CSV
- Computes an aggregate skill score using your rules
- Prioritizes by (lower aggregate first, then higher frequency)
- Builds a time-bounded session plan with spaced repetition
- Writes:
  - prioritized_shots.csv
  - session_plan_session{N}_{M}min.csv

Usage:
  python pool_trainer.py --csv "Pool shot database - nimo-251112.csv" --minutes 30 --session 1 --outdir ./out
"""

import argparse
import os
import sys
from collections import deque
import pandas as pd
from typing import List

# ----------------------------
# Mapping helpers
# ----------------------------


def _norm(s):
    if pd.isna(s):
        return ""
    return str(s).strip().lower()


def map_comfort_or_viz(val: str) -> int:
    """
    Map comfort & visualization textual levels to 1..4.
    Unknown/empty -> 1 (most conservative).
    """
    v = _norm(val)
    if v in {"unfamiliar"}:
        return 1
    if v in {"somewhat unfamiliar", "somwhat unfamiliar", "somewhat-unfamiliar"}:
        return 2
    if v in {"somewhat familiar", "somewhat-familiar"}:
        return 3
    if v in {"familiar"}:
        return 4
    return 1


def map_yes_no(val: str) -> int:
    """
    Yes/No -> 1/0. Unknown -> 0 (assume not applied/incorrect).
    """
    v = _norm(val)
    if v in {"yes", "y", "true"}:
        return 1
    if v in {"no", "n", "false"}:
        return 0
    return 0


def map_result(val: str) -> int:
    """
    Result to 1..2. Unknown -> 1 (conservative).
    1 = Not good attempt, 2 = Good attempt
    """
    v = _norm(val)
    if v in {"good attempt", "good", "made"}:
        return 2
    if v in {"not good attempt", "not good", "missed", "bad"}:
        return 1
    return 1


def map_frequency(val: str) -> int:
    """
    Low/Medium/High -> 1..3. Unknown -> 2 (middle).
    """
    v = _norm(val)
    if v == "low":
        return 1
    if v == "medium":
        return 2
    if v == "high":
        return 3
    return 2


# ----------------------------
# Column detection
# ----------------------------


def find_col(df: pd.DataFrame, must_include: List[str], friendly_name: str) -> str:
    for c in df.columns:
        low = c.lower()
        if all(token in low for token in must_include):
            return c
    raise KeyError(
        f"Could not find a column for '{friendly_name}'. "
        f"Looking for tokens: {must_include}. Present columns: {list(df.columns)}"
    )


# ----------------------------
# Aggregation (your rules)
# ----------------------------


def compute_aggregate(row) -> int:
    """
    Rules recap:
    1) if comfort and visualization are the lowest (both == 1) -> overall = 1
    2) if beautiful stroke OR alignment incorrect -> result doesn't matter -> overall = 2
    3) else, result impacts score: Not good -> 2, Good -> 3
    (Lower = needs more training)
    """
    if row["comfort_num"] == 1 and row["viz_num"] == 1:
        return 1
    if (row["stroke_ok"] == 0) or (row["align_ok"] == 0):
        return 2
    return 2 if row["result_num"] == 1 else 3


def focus_hint(r, col_comfort, col_viz, col_stroke, col_align, col_result) -> str:
    cues = []
    if map_comfort_or_viz(r[col_comfort]) == 1 and map_comfort_or_viz(r[col_viz]) == 1:
        cues.append("Rehearse picture: pre-shot visualization + aim map")
    if _norm(r[col_stroke]) in {"no"}:
        cues.append("Emphasize smooth stroke; no decel; hold still")
    if _norm(r[col_align]) in {"no"}:
        cues.append("Re-check stance/eye line; ghost-ball to aim")
    if _norm(r[col_result]) in {"not good attempt", "not good", "missed", "bad"}:
        cues.append("Slow pace; commit to line before stroke")
    if not cues:
        cues.append("Groove pattern; confirm cue-ball path")
    return " | ".join(cues)


# ----------------------------
# Plan generation
# ----------------------------


def generate_session_plan(
    df_prioritized: pd.DataFrame,
    minutes: int,
    session_num: int,
    col_id: str,
    col_desc: str,
    col_freq: str,
    col_comfort: str,
    col_viz: str,
    col_stroke: str,
    col_align: str,
    col_result: str,
) -> pd.DataFrame:
    """Build a block-based session plan that follows the new training spec."""

    SHOTS_PER_MINUTE = 2
    TARGET_BLOCK_MINUTES = 20
    WARMUP_DEFAULT = 10
    COOLDOWN_DEFAULT = 10

    def safe_text(val) -> str:
        if pd.isna(val):
            return ""
        return str(val)

    def shot_key(row: dict) -> str:
        ident = safe_text(row.get(col_id, ""))
        if ident:
            return ident
        desc_val = safe_text(row.get(col_desc, ""))
        if desc_val:
            return desc_val
        return str(row.get("index", ""))

    total_minutes = max(1, int(minutes))
    warm_minutes = WARMUP_DEFAULT
    cool_minutes = COOLDOWN_DEFAULT
    buffer_total = WARMUP_DEFAULT + COOLDOWN_DEFAULT
    if total_minutes < buffer_total:
        scale = total_minutes / buffer_total
        warm_minutes = max(1, int(round(WARMUP_DEFAULT * scale)))
        cool_minutes = max(1, int(round(COOLDOWN_DEFAULT * scale)))
        while warm_minutes + cool_minutes > total_minutes:
            if cool_minutes >= warm_minutes and cool_minutes > 1:
                cool_minutes -= 1
            elif warm_minutes > 1:
                warm_minutes -= 1
            else:
                break
    practice_minutes = max(0, total_minutes - warm_minutes - cool_minutes)

    eligible_mask = (session_num - 1) % df_prioritized["spaced_period"] == 0
    eligible_rows = (
        df_prioritized[eligible_mask]
        .reset_index()
        .to_dict(orient="records")
    )
    backfill_rows = (
        df_prioritized[~eligible_mask]
        .reset_index()
        .to_dict(orient="records")
    )
    shot_queue = deque(eligible_rows + backfill_rows)

    plan_rows = []
    minute_cursor = 0

    def add_generic_block(phase: str, activity: str, duration: int, focus: str) -> None:
        nonlocal minute_cursor
        if duration <= 0:
            return
        plan_rows.append(
            {
                "Time Block": f"{minute_cursor:02d}–{minute_cursor + duration:02d}",
                "Phase": phase,
                "Activity": activity,
                "Instance Plan": activity,
                "Duration (min)": duration,
                "Shots Planned": duration * SHOTS_PER_MINUTE,
                col_id: "",
                col_desc: "",
                "aggregate_skill": "",
                "spaced_period": "",
                col_freq: "",
                "Spacing Note": "",
                "Focus": focus,
            }
        )
        minute_cursor += duration

    def add_shot_block(
        row: dict,
        label: str,
        duration: int,
        variant: bool = False,
        reinforcement: bool = False,
    ) -> None:
        nonlocal minute_cursor
        if duration <= 0 or not row:
            return
        desc_val = safe_text(row.get(col_desc, "")) or safe_text(row.get(col_id, ""))
        block_label = label
        if duration < TARGET_BLOCK_MINUTES:
            block_label = f"{label} (short {duration}min)"
        activity = f"{block_label}: {desc_val}" if desc_val else block_label
        focus = focus_hint(row, col_comfort, col_viz, col_stroke, col_align, col_result)
        if variant:
            focus = f"Variant block (change speed/angle/spin). {focus}"
            instance_plan = (
                f"Rotate table positions & speeds for {desc_val or 'shot'}"
            )
        elif reinforcement:
            focus = f"Reinforce feel under fatigue. {focus}"
            instance_plan = f"Repeat the most successful layout for {desc_val or 'shot'}"
        else:
            focus = f"Same-instance reps. {focus}"
            instance_plan = (
                f"Clone the baseline layout for {desc_val or 'shot'} and stay at {SHOTS_PER_MINUTE} shots/min"
            )
        spaced = row.get("spaced_period", 1)
        spacing_note = (
            f"Spacing every {spaced} session(s); next revisit session {session_num + int(spaced)}"
            if spaced
            else ""
        )
        plan_rows.append(
            {
                "Time Block": f"{minute_cursor:02d}–{minute_cursor + duration:02d}",
                "Phase": "Shot Work",
                "Activity": activity,
                "Instance Plan": instance_plan,
                "Duration (min)": duration,
                "Shots Planned": duration * SHOTS_PER_MINUTE,
                col_id: safe_text(row.get(col_id, "")),
                col_desc: safe_text(row.get(col_desc, "")),
                "aggregate_skill": row.get("aggregate_skill", ""),
                "spaced_period": row.get("spaced_period", ""),
                col_freq: safe_text(row.get(col_freq, "")),
                "Spacing Note": spacing_note,
                "Focus": focus,
            }
        )
        minute_cursor += duration

    def next_shot() -> dict:
        while shot_queue:
            candidate = shot_queue.popleft()
            key = shot_key(candidate)
            if key in used_ids:
                continue
            return candidate
        return {}

    used_ids = set()
    foundation_targets: List[dict] = []

    # Warm-up block
    add_generic_block(
        "Warm-up",
        "Warm-up & mechanics (progressive stop shots, line-up drill)",
        warm_minutes,
        "Loosen arm, calibrate cue-ball, rehearse PSR at 2 shots/min.",
    )

    remaining_practice = practice_minutes
    if remaining_practice <= 0:
        add_generic_block(
            "Cool-down",
            "Cool-down & reflection",
            cool_minutes,
            "Breathe, stretch, write quick notes.",
        )
        return pd.DataFrame(plan_rows)

    recommended_shots = 2 if len(shot_queue) >= 2 else 1
    recommended_shots = min(recommended_shots, len(shot_queue)) if shot_queue else 0

    # First pass: give each recommended shot type a 20-minute same-instance block
    while remaining_practice > 0 and len(foundation_targets) < recommended_shots:
        shot = next_shot()
        if not shot:
            break
        key = shot_key(shot)
        if key:
            used_ids.add(key)
        duration = min(TARGET_BLOCK_MINUTES, remaining_practice)
        add_shot_block(shot, "Core reps", duration)
        foundation_targets.append(shot)
        remaining_practice -= duration

    # Second pass: add variant blocks for those shot types if time allows
    for shot in foundation_targets:
        if remaining_practice <= 0:
            break
        duration = min(TARGET_BLOCK_MINUTES, remaining_practice)
        add_shot_block(shot, "Variant exploration", duration, variant=True)
        remaining_practice -= duration

    # Additional shot types or reinforcement while time remains
    while remaining_practice > 0:
        shot = next_shot()
        if shot:
            key = shot_key(shot)
            if key:
                used_ids.add(key)
            duration = min(TARGET_BLOCK_MINUTES, remaining_practice)
            add_shot_block(shot, "Core reps", duration)
            foundation_targets.append(shot)
            remaining_practice -= duration
            if remaining_practice <= 0:
                break
            duration = min(TARGET_BLOCK_MINUTES, remaining_practice)
            add_shot_block(shot, "Variant exploration", duration, variant=True)
            remaining_practice -= duration
        else:
            # No new shots left: reinforce the highest-priority one
            if not foundation_targets:
                break
            duration = min(TARGET_BLOCK_MINUTES, remaining_practice)
            add_shot_block(
                foundation_targets[0],
                "Reinforcement",
                duration,
                reinforcement=True,
            )
            remaining_practice -= duration

    # Cool-down block
    add_generic_block(
        "Cool-down",
        "Cool-down & reflection",
        cool_minutes,
        "Stretch, breathing, capture takeaways.",
    )

    final_cols = [
        "Time Block",
        "Phase",
        "Activity",
        "Instance Plan",
        "Duration (min)",
        "Shots Planned",
        col_id,
        col_desc,
        "aggregate_skill",
        "spaced_period",
        col_freq,
        "Spacing Note",
        "Focus",
    ]
    return pd.DataFrame(plan_rows, columns=final_cols)


# ----------------------------
# Main
# ----------------------------


def main():
    ap = argparse.ArgumentParser(
        description="Generate a pool training plan from an assessment CSV."
    )
    ap.add_argument("--csv", required=True, help="Path to the assessment CSV.")
    ap.add_argument(
        "--minutes",
        type=int,
        default=90,
        help="Session length in minutes (assume 2 shots/min; includes warm-up & cool-down).",
    )
    ap.add_argument(
        "--session",
        type=int,
        default=1,
        help="Session number for spaced repetition (1-based).",
    )
    ap.add_argument("--outdir", default=".", help="Directory to write output CSVs.")
    ap.add_argument(
        "--print",
        dest="print_console",
        action="store_true",
        help="Also print the session plan to console.",
    )
    args = ap.parse_args()

    if not os.path.isfile(args.csv):
        print(f"ERROR: CSV not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.outdir, exist_ok=True)

    df = pd.read_csv(args.csv)

    # Columns (fuzzy matching for robustness)
    col_id = "ID" if "ID" in df.columns else find_col(df, ["id"], "ID")
    col_desc = (
        "Description"
        if "Description" in df.columns
        else find_col(df, ["description"], "Description")
    )
    col_comfort = find_col(df, ["comfort level"], "Comfort level")
    col_viz = find_col(df, ["visualization fidelity"], "Visualization fidelity")
    col_stroke = find_col(df, ["beautiful", "stroke"], "Beautiful stroke applied")
    col_align = find_col(df, ["alignment", "correct"], "Alignment correct")
    col_result = find_col(df, ["result", "shot"], "Result of the shot")
    col_freq = find_col(df, ["frequency"], "Frequency")

    work = df.copy()
    work["comfort_num"] = work[col_comfort].map(map_comfort_or_viz)
    work["viz_num"] = work[col_viz].map(map_comfort_or_viz)
    work["stroke_ok"] = work[col_stroke].map(map_yes_no)  # 1 yes, 0 no
    work["align_ok"] = work[col_align].map(map_yes_no)  # 1 yes, 0 no
    work["result_num"] = work[col_result].map(map_result)  # 1 not good, 2 good
    work["freq_num"] = work[col_freq].map(map_frequency)  # 1 low, 2 med, 3 high

    work["aggregate_skill"] = work.apply(compute_aggregate, axis=1)
    work["spaced_period"] = work[
        "aggregate_skill"
    ]  # 1 every session; 2 every other; 3 every third

    # Sort: lower aggregate first; higher frequency next; then worse comfort/viz first
    work_sorted = work.sort_values(
        by=["aggregate_skill", "freq_num", "comfort_num", "viz_num"],
        ascending=[True, False, True, True],
    ).reset_index(drop=True)

    prioritized = work_sorted[
        [
            col_id,
            col_desc,
            col_comfort,
            col_viz,
            col_stroke,
            col_align,
            col_result,
            col_freq,
            "comfort_num",
            "viz_num",
            "stroke_ok",
            "align_ok",
            "result_num",
            "freq_num",
            "aggregate_skill",
            "spaced_period",
        ]
    ].copy()

    # Write prioritized list
    prioritized_path = os.path.join(args.outdir, "prioritized_shots.csv")
    prioritized.to_csv(prioritized_path, index=False)

    # Build session plan
    minutes = max(1, int(args.minutes))
    session_num = max(1, int(args.session))
    plan = generate_session_plan(
        prioritized,
        minutes,
        session_num,
        col_id,
        col_desc,
        col_freq,
        col_comfort,
        col_viz,
        col_stroke,
        col_align,
        col_result,
    )

    plan_path = os.path.join(
        args.outdir, f"session_plan_session{session_num}_{minutes}min.csv"
    )
    plan.to_csv(plan_path, index=False)

    # Console output (optional)
    if args.print_console:
        print("\n=== Session Plan ===")
        print(plan.to_string(index=False))
        print("\nWrote:")
        print(f"- {prioritized_path}")
        print(f"- {plan_path}")
    else:
        print("Wrote:")
        print(f"- {prioritized_path}")
        print(f"- {plan_path}")


if __name__ == "__main__":
    main()
