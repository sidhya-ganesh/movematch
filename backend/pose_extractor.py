"""
pose_extractor.py
Extracts MediaPipe Pose keypoints from a video file at ~5fps.
Saves output as JSON: { fps, frame_count, frames: [ {timestamp, keypoints: [{name,x,y,z,visibility}]} ] }

Falls back to stub data if MediaPipe is not installed (for local dev without GPU).
"""

import json
import time
from pathlib import Path
from typing import Callable, Optional

# MediaPipe landmark names we care about (33 total, we use these 17)
LANDMARK_NAMES = [
    "nose",
    "left_shoulder",  "right_shoulder",
    "left_elbow",     "right_elbow",
    "left_wrist",     "right_wrist",
    "left_hip",       "right_hip",
    "left_knee",      "right_knee",
    "left_ankle",     "right_ankle",
    "left_heel",      "right_heel",
    "left_foot_index","right_foot_index",
]

# MediaPipe landmark indices for the names above
LANDMARK_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]


class PoseExtractionError(Exception):
    pass


def extract_pose_sequence(
    video_path: str,
    output_path: str,
    progress_callback: Optional[Callable[[float], None]] = None,
    target_fps: float = 5.0,
) -> dict:
    """
    Extract pose keypoints from video_path, save to output_path as JSON.
    Returns the loaded pose data dict.
    progress_callback receives float 0.0–1.0.
    """
    try:
        return _extract_with_mediapipe(video_path, output_path, progress_callback, target_fps)
    except ImportError:
        # MediaPipe not installed — use stub for development
        print("[pose_extractor] MediaPipe not available, using stub data")
        return _extract_stub(video_path, output_path, progress_callback, target_fps)
    except Exception as e:
        raise PoseExtractionError(f"Pose extraction failed: {e}") from e

def _extract_with_mediapipe(
    video_path: str,
    output_path: str,
    progress_callback,
    target_fps: float,
) -> dict:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    import urllib.request
    import os

    # Download the pose landmarker model if not present
    model_path = Path(__file__).parent / "pose_landmarker.task"
    if not model_path.exists():
        print("[pose_extractor] Downloading pose landmarker model...")
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        urllib.request.urlretrieve(url, str(model_path))
        print("[pose_extractor] Model downloaded.")

    base_options = python.BaseOptions(model_asset_path=str(model_path))
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise PoseExtractionError(f"Could not open video: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = max(1, int(source_fps / target_fps))

    frames = []
    frame_idx = 0

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                timestamp = frame_idx / source_fps
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = landmarker.detect(mp_image)

                keypoints = []
                if result.pose_landmarks:
                    lms = result.pose_landmarks[0]
                    for i, name in zip(LANDMARK_INDICES, LANDMARK_NAMES):
                        lm = lms[i]
                        keypoints.append({
                            "name": name,
                            "x": lm.x,
                            "y": lm.y,
                            "z": lm.z,
                            "visibility": lm.visibility,
                        })

                frames.append({"timestamp": timestamp, "keypoints": keypoints})

                if progress_callback and total_frames > 0:
                    progress_callback(frame_idx / total_frames)

            frame_idx += 1

    cap.release()

    data = {
        "source_fps": source_fps,
        "target_fps": target_fps,
        "frame_count": len(frames),
        "duration": frame_idx / source_fps,
        "frames": frames,
    }

    Path(output_path).write_text(json.dumps(data))
    if progress_callback:
        progress_callback(1.0)
    return data

def _extract_stub(
    video_path: str,
    output_path: str,
    progress_callback,
    target_fps: float,
) -> dict:
    """
    Generates realistic-looking synthetic pose data for development/testing
    when MediaPipe is not installed.
    """
    import math, random

    duration = 10.0  # 10-second stub
    n_frames = int(duration * target_fps)
    frames = []

    for i in range(n_frames):
        t = i / target_fps
        progress = i / n_frames

        if progress_callback:
            progress_callback(progress)

        # Simulate a dancer: oscillating arms, slight body bob
        arm_wave = math.sin(t * 0.8) * 0.08
        leg_bend = abs(math.sin(t * 0.5)) * 0.05
        bob = math.sin(t * 1.5) * 0.01

        cx, cy = 0.5, 0.35
        kps = [
            {"name": "nose",              "x": cx,               "y": cy - 0.15 + bob,  "z": 0.0, "visibility": 0.99},
            {"name": "left_shoulder",     "x": cx - 0.12,        "y": cy + bob,          "z": 0.0, "visibility": 0.97},
            {"name": "right_shoulder",    "x": cx + 0.12,        "y": cy + bob,          "z": 0.0, "visibility": 0.97},
            {"name": "left_elbow",        "x": cx - 0.18 - arm_wave, "y": cy + 0.12 + bob, "z": 0.0, "visibility": 0.95},
            {"name": "right_elbow",       "x": cx + 0.18 + arm_wave, "y": cy + 0.12 + bob, "z": 0.0, "visibility": 0.95},
            {"name": "left_wrist",        "x": cx - 0.22 - arm_wave * 1.5, "y": cy + 0.27 + bob, "z": 0.0, "visibility": 0.93},
            {"name": "right_wrist",       "x": cx + 0.22 + arm_wave * 1.5, "y": cy + 0.27 + bob, "z": 0.0, "visibility": 0.93},
            {"name": "left_hip",          "x": cx - 0.08,        "y": cy + 0.28 + bob,  "z": 0.0, "visibility": 0.96},
            {"name": "right_hip",         "x": cx + 0.08,        "y": cy + 0.28 + bob,  "z": 0.0, "visibility": 0.96},
            {"name": "left_knee",         "x": cx - 0.09 - leg_bend, "y": cy + 0.50,    "z": 0.0, "visibility": 0.94},
            {"name": "right_knee",        "x": cx + 0.09 + leg_bend, "y": cy + 0.50,    "z": 0.0, "visibility": 0.94},
            {"name": "left_ankle",        "x": cx - 0.09,        "y": cy + 0.70,        "z": 0.0, "visibility": 0.92},
            {"name": "right_ankle",       "x": cx + 0.09,        "y": cy + 0.70,        "z": 0.0, "visibility": 0.92},
            {"name": "left_heel",         "x": cx - 0.09,        "y": cy + 0.73,        "z": 0.0, "visibility": 0.88},
            {"name": "right_heel",        "x": cx + 0.09,        "y": cy + 0.73,        "z": 0.0, "visibility": 0.88},
            {"name": "left_foot_index",   "x": cx - 0.07,        "y": cy + 0.75,        "z": 0.0, "visibility": 0.85},
            {"name": "right_foot_index",  "x": cx + 0.07,        "y": cy + 0.75,        "z": 0.0, "visibility": 0.85},
        ]
        frames.append({"timestamp": t, "keypoints": kps})
        time.sleep(0.002)  # simulate processing time

    data = {
        "source_fps": 30.0,
        "target_fps": target_fps,
        "frame_count": len(frames),
        "duration": duration,
        "frames": frames,
        "_stub": True,
    }
    Path(output_path).write_text(json.dumps(data))
    if progress_callback:
        progress_callback(1.0)
    return data
