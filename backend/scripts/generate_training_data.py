"""
generate_training_data.py — Generate synthetic XGBoost training data.

Generates 2000 samples (500 per class) with clinically motivated
feature distributions based on ADHD research.

Classes:
  0 = fatigue      — tired student, long session, low focus, low blink rate
  1 = difficulty   — struggling with content, medium focus, high variance
  2 = environment  — external distractions, variable focus, high blink rate
  3 = unknown      — random across all ranges

Why synthetic data?
  We don't yet have real labeled sessions from Tunisian classrooms.
  Synthetic data lets us validate the ML pipeline end-to-end.
  The distributions are chosen to be separable — XGBoost should achieve
  80-95% accuracy on this data. Real data will require retraining.

Run: python scripts/generate_training_data.py
Output: scripts/training_data.csv
"""
import numpy as np
import pandas as pd
from pathlib import Path


def gen_fatigue(n=500) -> pd.DataFrame:
    """
    Fatigue pattern: student is tired.
    - Low focus score (0.1-0.38) — hard to concentrate when sleepy
    - Low focus std (0.02-0.12) — consistently low, not fluctuating
    - Low blink rate (4-11/min) — tired eyes blink less (normal is 15-20)
    - Head pose near 0 but drifting (5-20 deg) — head drooping forward
    - Long sessions (3600-7200s = 1-2 hours) — fatigue accumulates over time
    - Late in the day (time_of_day_norm 0.6-1.0) — afternoon slump
    """
    return pd.DataFrame({
        'avg_focus_60s':        np.random.uniform(0.10, 0.38, n),
        'focus_std_60s':        np.random.uniform(0.02, 0.12, n),
        'blink_rate':           np.random.uniform(4,    11,   n),
        'head_pose_deg':        np.random.uniform(5,    20,   n),
        'time_of_day_norm':     np.random.uniform(0.6,  1.0,  n),
        'session_duration_sec': np.random.uniform(3600, 7200, n),
        'subject_id_encoded':   np.random.randint(0, 10, n),
        'label': 0
    })


def gen_difficulty(n=500) -> pd.DataFrame:
    """
    Difficulty pattern: struggling with the subject.
    - Medium-low focus (0.2-0.45) — trying but failing to understand
    - High std (0.08-0.2) — focus fluctuates as they try and give up
    - Medium blink rate (8-15/min) — normal but stressed
    - More head movement (10-30 deg) — looking away, thinking, checking notes
    - Any session length (600-5400s) — can happen early or late in session
    - Any time of day — not time-dependent
    """
    return pd.DataFrame({
        'avg_focus_60s':        np.random.uniform(0.20, 0.45, n),
        'focus_std_60s':        np.random.uniform(0.08, 0.20, n),
        'blink_rate':           np.random.uniform(8,    15,   n),
        'head_pose_deg':        np.random.uniform(10,   30,   n),
        'time_of_day_norm':     np.random.uniform(0.0,  1.0,  n),
        'session_duration_sec': np.random.uniform(600,  5400, n),
        'subject_id_encoded':   np.random.randint(0, 10, n),
        'label': 1
    })


def gen_environment(n=500) -> pd.DataFrame:
    """
    Environment pattern: external distractions (noise, phone, siblings).
    - Variable focus (0.3-0.6) — distracted momentarily but recovers
    - Very high std (0.4-0.75) — sharp drops when distracted, recovery peaks
    - High blink rate (18-35/min) — looking around frequently, eyes moving
    - High head pose variance (20-45 deg) — turning head toward distractions
    - Short to medium sessions (300-3600s) — often happens early in session
    """
    return pd.DataFrame({
        'avg_focus_60s':        np.random.uniform(0.30, 0.60, n),
        'focus_std_60s':        np.random.uniform(0.40, 0.75, n),
        'blink_rate':           np.random.uniform(18,   35,   n),
        'head_pose_deg':        np.random.uniform(20,   45,   n),
        'time_of_day_norm':     np.random.uniform(0.0,  1.0,  n),
        'session_duration_sec': np.random.uniform(300,  3600, n),
        'subject_id_encoded':   np.random.randint(0, 10, n),
        'label': 2
    })


def gen_unknown(n=500) -> pd.DataFrame:
    """
    Unknown pattern: random across all ranges.
    Represents cases that don't fit the other patterns clearly —
    could be mixed causes, model uncertainty, or data quality issues.
    """
    return pd.DataFrame({
        'avg_focus_60s':        np.random.uniform(0.0,  1.0,  n),
        'focus_std_60s':        np.random.uniform(0.0,  0.8,  n),
        'blink_rate':           np.random.uniform(2,    40,   n),
        'head_pose_deg':        np.random.uniform(0,    50,   n),
        'time_of_day_norm':     np.random.uniform(0.0,  1.0,  n),
        'session_duration_sec': np.random.uniform(60,   7200, n),
        'subject_id_encoded':   np.random.randint(0, 10, n),
        'label': 3
    })


if __name__ == "__main__":
    np.random.seed(42)  # reproducible results — same CSV every run

    df = pd.concat([
        gen_fatigue(500),
        gen_difficulty(500),
        gen_environment(500),
        gen_unknown(500),
    ], ignore_index=True)

    # Shuffle so classes are not grouped — XGBoost trains better on shuffled data
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    output_path = Path(__file__).parent / "training_data.csv"
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} samples")
    print(f"Class distribution:\n{df['label'].value_counts().sort_index()}")
    print(f"Saved to: {output_path}")
