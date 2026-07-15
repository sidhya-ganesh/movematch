"""
feedback_generator.py
Turns numeric per-joint DTW comparison scores into natural-language coaching
feedback using the Claude API. Falls back to a templated summary if the API
call fails or no API key is configured, so scoring never breaks if this does.
"""

import os
import json
from typing import Optional

import anthropic

MODEL = "claude-sonnet-4-6"

# Joints below this score are called out by name in the prompt as the
# specific things to give feedback on — keeps Claude anchored to the real
# numbers instead of inventing generic advice.
WEAK_JOINT_THRESHOLD = 70.0
MAX_WEAK_JOINTS = 4


def _readable_joint(name: str) -> str:
    """left_wrist -> 'left wrist'"""
    return name.replace("_", " ")


def _client() -> Optional[anthropic.Anthropic]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)


def _fallback_feedback(overall: float, joint_scores: dict) -> str:
    """Simple templated feedback used if Claude is unavailable — keeps the
    feature degrading gracefully instead of failing the whole submission."""
    if not joint_scores:
        return f"Overall score: {overall:.0f}%. Keep practicing!"

    weakest = sorted(joint_scores.items(), key=lambda kv: kv[1])[:MAX_WEAK_JOINTS]
    weak_names = ", ".join(_readable_joint(n) for n, s in weakest if s < WEAK_JOINT_THRESHOLD)

    if weak_names:
        return (
            f"Overall score: {overall:.0f}%. Focus on your {weak_names} — "
            f"these had the biggest gap from the reference routine."
        )
    return f"Overall score: {overall:.0f}%. Strong form across the board — keep it up!"


def generate_coaching_feedback(
    overall_score: float,
    joint_scores: dict,
    routine_name: str = "this routine",
) -> str:
    """
    Feed DTW-derived joint deviation scores into Claude to generate specific,
    encouraging, actionable coaching feedback for a dance student.

    joint_scores: {joint_name: score_0_to_100}, higher = closer to reference.
    """
    client = _client()
    if client is None:
        return _fallback_feedback(overall_score, joint_scores)

    weakest = sorted(joint_scores.items(), key=lambda kv: kv[1])[:MAX_WEAK_JOINTS]
    joint_summary = "\n".join(
        f"- {_readable_joint(name)}: {score:.0f}/100"
        for name, score in weakest
    )

    prompt = f"""You are a supportive dance coach giving feedback to a student who just
practiced "{routine_name}". Their movement was captured and compared joint-by-joint
against a reference performance using motion tracking.

Overall similarity score: {overall_score:.0f}/100

Their lowest-scoring joints (0-100, lower = further from the reference):
{joint_summary}

Write 2-3 sentences of specific, encouraging coaching feedback. Reference the
actual joints listed above by name and give a concrete correction for each
weak one (e.g. what to think about or adjust), not generic advice like "keep
practicing". Address the student directly. Do not mention "DTW", "scores", or
any technical/measurement language — talk like a real dance teacher, not a
system reporting numbers."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        text_blocks = [b.text for b in response.content if b.type == "text"]
        feedback = "\n".join(text_blocks).strip()
        return feedback if feedback else _fallback_feedback(overall_score, joint_scores)
    except Exception as e:
        print(f"[feedback_generator] Claude API call failed, using fallback: {e}")
        return _fallback_feedback(overall_score, joint_scores)
