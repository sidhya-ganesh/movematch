"""
comparison_engine.py
Compares two pose sequences (reference vs student) using DTW alignment.
Produces per-joint scores and renders a side-by-side skeleton overlay video.
"""

import json
import math
import numpy as np
from pathlib import Path
from typing import Optional

# Joint weights — higher = more important for scoring
# Tuned for Bharatanatyam but works for any style.
# Teachers can override these per-routine in a future version.
JOINT_WEIGHTS = {
    "left_shoulder":    1.4,
    "right_shoulder":   1.4,
    "left_elbow":       1.6,
    "right_elbow":      1.6,
    "left_wrist":       1.8,   # hand gestures (mudras) are critical
    "right_wrist":      1.8,
    "left_hip":         1.2,
    "right_hip":        1.2,
    "left_knee":        1.3,
    "right_knee":       1.3,
    "left_ankle":       1.5,   # footwork
    "right_ankle":      1.5,
    "left_heel":        1.0,
    "right_heel":       1.0,
    "left_foot_index":  1.0,
    "right_foot_index": 1.0,
    "nose":             0.5,
}

SKELETON_CONNECTIONS = [
    ("left_shoulder",  "right_shoulder"),
    ("left_shoulder",  "left_elbow"),
    ("left_elbow",     "left_wrist"),
    ("right_shoulder", "right_elbow"),
    ("right_elbow",    "right_wrist"),
    ("left_shoulder",  "left_hip"),
    ("right_shoulder", "right_hip"),
    ("left_hip",       "right_hip"),
    ("left_hip",       "left_knee"),
    ("left_knee",      "left_ankle"),
    ("right_hip",      "right_knee"),
    ("right_knee",     "right_ankle"),
    ("left_ankle",     "left_heel"),
    ("right_ankle",    "right_heel"),
]


def load_pose_data(path: str) -> dict:
    return json.loads(Path(path).read_text())


def _frame_to_vec(keypoints: list) -> np.ndarray:
    """Convert keypoint list to flat numpy vector [x0,y0,x1,y1,...] for DTW."""
    pm = {kp["name"]: kp for kp in keypoints}
    vec = []
    for name in JOINT_WEIGHTS:
        kp = pm.get(name)
        if kp and kp.get("visibility", 0) > 0.3:
            vec.extend([kp["x"], kp["y"]])
        else:
            vec.extend([0.0, 0.0])
    return np.array(vec, dtype=np.float32)


def _normalize_pose(keypoints: list) -> list:
    """
    Normalise pose to be scale/position invariant.
    Uses shoulder midpoint as origin, shoulder width as scale.
    """
    pm = {kp["name"]: kp for kp in keypoints}
    ls = pm.get("left_shoulder")
    rs = pm.get("right_shoulder")
    if not ls or not rs:
        return keypoints

    mx = (ls["x"] + rs["x"]) / 2
    my = (ls["y"] + rs["y"]) / 2
    scale = math.sqrt((ls["x"] - rs["x"])**2 + (ls["y"] - rs["y"])**2)
    if scale < 1e-6:
        return keypoints

    return [
        {**kp, "x": (kp["x"] - mx) / scale, "y": (kp["y"] - my) / scale}
        for kp in keypoints
    ]


def _compare_frames(ref_kps: list, stu_kps: list) -> tuple[float, dict]:
    """
    Compare two frames. Returns (overall_similarity 0-100, per_joint_scores).
    """
    ref_norm = _normalize_pose(ref_kps)
    stu_norm = _normalize_pose(stu_kps)

    ref_map = {kp["name"]: kp for kp in ref_norm}
    stu_map = {kp["name"]: kp for kp in stu_norm}

    total_weighted_score = 0.0
    total_weight = 0.0
    joint_scores = {}

    for name, weight in JOINT_WEIGHTS.items():
        ref_kp = ref_map.get(name)
        stu_kp = stu_map.get(name)

        if (not ref_kp or not stu_kp
                or ref_kp.get("visibility", 0) < 0.3
                or stu_kp.get("visibility", 0) < 0.3):
            continue

        dist = math.sqrt(
            (ref_kp["x"] - stu_kp["x"])**2 +
            (ref_kp["y"] - stu_kp["y"])**2
        )
        # Convert distance to score: dist=0 → 100, dist=0.5 → ~0
        # score = max(0.0, 100.0 - dist * 200.0)
        # More forgiving scoring — small differences don't tank the score
        # dist=0 → 100, dist=0.3 → ~70, dist=0.5 → ~50
        score = max(0.0, 100.0 - dist * 120.0)
        # Apply a curve so scores cluster higher (more encouraging)
        score = 100.0 - (100.0 - score) * 0.7
        joint_scores[name] = round(score, 1)
        total_weighted_score += score * weight
        total_weight += weight

    if total_weight == 0:
        return 75.0, {}

    overall = total_weighted_score / total_weight
    return round(overall, 2), joint_scores


def _dtw_align(ref_frames: list, stu_frames: list) -> list[tuple[int, int]]:
    """
    Dynamic Time Warping alignment.
    Returns list of (ref_idx, stu_idx) pairs.
    """
    n, m = len(ref_frames), len(stu_frames)
    if n == 0 or m == 0:
        return []

    # Build distance matrix
    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0.0

    ref_vecs = [_frame_to_vec(f["keypoints"]) for f in ref_frames]
    stu_vecs = [_frame_to_vec(f["keypoints"]) for f in stu_frames]

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = float(np.linalg.norm(ref_vecs[i - 1] - stu_vecs[j - 1]))
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])

    # Backtrack
    path = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        options = [(dtw[i - 1, j], i - 1, j), (dtw[i, j - 1], i, j - 1), (dtw[i - 1, j - 1], i - 1, j - 1)]
        _, i, j = min(options, key=lambda x: x[0])
    path.reverse()
    return path


def compare_sequences(ref_pose_path: str, student_pose_path: str) -> dict:
    """
    Load two pose JSONs, DTW-align them, score every aligned pair.
    Returns { overall, pose, joints: {name: avg_score} }
    """
    ref_data = load_pose_data(ref_pose_path)
    stu_data = load_pose_data(student_pose_path)

    ref_frames = ref_data["frames"]
    stu_frames = stu_data["frames"]

    alignment = _dtw_align(ref_frames, stu_frames)
    if not alignment:
        return {"overall": 0.0, "pose": 0.0, "joints": {}}

    overall_scores = []
    joint_accum: dict[str, list] = {}

    for ri, si in alignment:
        ref_kps = ref_frames[ri]["keypoints"]
        stu_kps = stu_frames[si]["keypoints"]
        frame_score, joint_scores = _compare_frames(ref_kps, stu_kps)
        overall_scores.append(frame_score)
        for jname, jscore in joint_scores.items():
            joint_accum.setdefault(jname, []).append(jscore)

    # overall = round(float(np.mean(overall_scores)), 1) if overall_scores else 0.0
    # Boost overall score slightly — timing delays shouldn't tank everything
    raw = float(np.mean(overall_scores)) if overall_scores else 0.0
    overall = round(min(100.0, raw * 1.15), 1)
    joint_avgs = {j: round(float(np.mean(v)), 1) for j, v in joint_accum.items()}

    return {
        "overall": overall,
        "pose": overall,          # same for MVP; split when timing added
        "joints": joint_avgs,
    }


def generate_skeleton_overlay(
    ref_video_path: str,
    student_video_path: str,
    ref_pose_path: str,
    student_pose_path: str,
    output_path: str,
    width: int = 1280,
    height: int = 480,
) -> tuple[bool, str]:
    """
    Render side-by-side: reference skeleton (left) | student skeleton (right).
    Both overlaid on a dark background. Output saved to output_path.

    Returns (success: bool, error_reason: str).
    error_reason is one of:
      ""                  — success
      "opencv_unavailable" — opencv-python not installed
      "codec_error"        — opencv installed but MP4 encoding failed
      "render_error"       — any other rendering failure
    """
    try:
        _render_overlay_cv2(
            ref_video_path, student_video_path,
            ref_pose_path, student_pose_path,
            output_path, width, height
        )
        return True, ""

    except ImportError:
        return False, "opencv_unavailable"

    except cv2_codec_error:
        return False, "codec_error"

    except Exception as e:
        return False, f"render_error: {e}"


# Sentinel so we can catch codec errors specifically without importing cv2 at module level
class cv2_codec_error(Exception):
    pass


def _render_overlay_cv2(
    ref_video_path, student_video_path,
    ref_pose_path, student_pose_path,
    output_path, width, height
):
    import cv2

    ref_data = load_pose_data(ref_pose_path)
    stu_data = load_pose_data(student_pose_path)

    ref_frames = ref_data["frames"]
    stu_frames = stu_data["frames"]

    alignment = _dtw_align(ref_frames, stu_frames)
    if not alignment:
        return

    cap_ref = cv2.VideoCapture(ref_video_path)
    cap_stu = cv2.VideoCapture(student_video_path)

    # source_fps = cap_ref.get(cv2.CAP_PROP_FPS) or 30.0
    source_fps = (cap_ref.get(cv2.CAP_PROP_FPS) or 30.0) * 0.3
    half_w = width // 2

    # fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    # fourcc = cv2.VideoWriter_fourcc(*"avc1")
    # fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    # out = cv2.VideoWriter(output_path, fourcc, source_fps, (width, height))

    out = None
    for codec in ["avc1", "mp4v", "XVID"]:
        fourcc = cv2.VideoWriter_fourcc(*codec)
        out = cv2.VideoWriter(output_path, fourcc, source_fps, (width, height))
        if out.isOpened():
            break

    # VideoWriter silently returns an unopened writer if the codec is missing
    if not out.isOpened():
        cap_ref.release()
        cap_stu.release()
        raise cv2_codec_error("VideoWriter failed — mp4v codec unavailable on this system")


    bg_color  = (10, 10, 20)       # dark navy
    ref_color = (58, 134, 255)     # blue — reference
    stu_colors = {
        "good":  (6, 214, 160),    # green
        "ok":    (255, 190, 11),   # amber
        "miss":  (255, 0, 110),    # red
    }

    def _draw_pose(frame, kps, color, offset_x=0, scale_x=1.0, scale_y=1.0):
        pm = {kp["name"]: kp for kp in kps}
        for a, b in SKELETON_CONNECTIONS:
            ka, kb = pm.get(a), pm.get(b)
            if not ka or not kb:
                continue
            if ka.get("visibility", 0) < 0.3 or kb.get("visibility", 0) < 0.3:
                continue
            x1 = int(ka["x"] * scale_x) + offset_x
            y1 = int(ka["y"] * scale_y)
            x2 = int(kb["x"] * scale_x) + offset_x
            y2 = int(kb["y"] * scale_y)
            cv2.line(frame, (x1, y1), (x2, y2), color, 3, cv2.LINE_AA)
        for kp in kps:
            if kp.get("visibility", 0) < 0.3:
                continue
            x = int(kp["x"] * scale_x) + offset_x
            y = int(kp["y"] * scale_y)
            cv2.circle(frame, (x, y), 5, color, -1, cv2.LINE_AA)

    for ri, si in alignment:
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = bg_color

        # Labels
        cv2.putText(frame, "REFERENCE", (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 100, 180), 1)
        cv2.putText(frame, "YOU", (half_w + 10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        # Divider
        cv2.line(frame, (half_w, 0), (half_w, height), (40, 40, 60), 1)

        ref_kps = ref_frames[ri]["keypoints"]
        stu_kps = stu_frames[si]["keypoints"]

        # Score to pick student color
        score, _ = _compare_frames(ref_kps, stu_kps)
        stu_color = stu_colors["good"] if score >= 80 else stu_colors["ok"] if score >= 60 else stu_colors["miss"]

        _draw_pose(frame, ref_kps, ref_color, offset_x=0,        scale_x=half_w, scale_y=height)
        _draw_pose(frame, stu_kps, stu_color, offset_x=half_w,   scale_x=half_w, scale_y=height)

        # Score overlay
        cv2.putText(frame, f"{score:.0f}%", (width - 70, height - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, stu_color, 2)

        out.write(frame)

    cap_ref.release()
    cap_stu.release()
    out.release()
