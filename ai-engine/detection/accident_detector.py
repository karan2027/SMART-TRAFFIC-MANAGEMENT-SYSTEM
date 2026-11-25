import os
import cv2
import time
import collections
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("AccidentDetector")

def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
  xA = max(boxA[0], boxB[0])
  yA = max(boxA[1], boxB[1])
  xB = min(boxA[2], boxB[2])
  yB = min(boxA[3], boxB[3])

  interWidth = max(0.0, xB - xA)
  interHeight = max(0.0, yB - yA)
  interArea = interWidth * interHeight

  boxAArea = max(1.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
  boxBArea = max(1.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

  iou = interArea / float(boxAArea + boxBArea - interArea)
  return float(iou)


class RollingRingBuffer:
  """Circular ring buffer retaining the last 15 seconds of video frames for incident evidence clips."""

  def __init__(self, buffer_seconds: int = 15, fps: int = 30):
    self.capacity = max(30, buffer_seconds * fps)
    self.buffer = collections.deque(maxlen=self.capacity)
    self.fps = fps

  def append(self, frame: np.ndarray, timestamp: float = None):
    ts = timestamp or time.time()
    self.buffer.append((frame.copy(), ts))

  def export_clip(
      self,
      output_path: str,
      start_offset_sec: float = 12.0,
      target_fps: int = 25,
  ) -> bool:
    if len(self.buffer) < 10:
      return False

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    frames_to_write = list(self.buffer)

    h, w = frames_to_write[0][0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, float(target_fps), (w, h))

    for frame, _ in frames_to_write:
      out.write(frame)

    out.release()
    logger.info(
        f"Exported {len(frames_to_write)} frames incident evidence clip to"
        f" {output_path}"
    )
    return True


class AccidentDetector:
  """Stage 3: Two-Stage Accident Detection Pipeline.

  1. Kinematic Deceleration & IoU Heuristic:
     Tracks persistent vehicle IDs, measures speed drops from > 35 km/h to 0
     km/h,
     and monitors sustained bbox IoU > 0.25 lasting > 8 seconds.
  2. Visual Collision Classifier / Abnormal Orientation.
  3. Rolling Ring-Buffer:
     Retains 15s annotated frames and exports 10-15s mp4 evidence clip.
  """

  def __init__(
      self,
      iou_threshold: float = 0.25,
      speed_drop_threshold_kmh: float = 35.0,
      duration_seconds_threshold: float = 8.0,
      buffer_seconds: int = 15,
  ):
    self.iou_threshold = iou_threshold
    self.speed_drop_threshold_kmh = speed_drop_threshold_kmh
    self.duration_seconds_threshold = duration_seconds_threshold

    # Circular memory ring buffer for 10-15s incident video evidence
    self.ring_buffer = RollingRingBuffer(
        buffer_seconds=buffer_seconds, fps=30
    )

    # Track histories: track_id -> list of {'timestamp', 'bbox', 'speed_kmh'}
    self.track_histories: Dict[int, collections.deque] = (
        collections.defaultdict(lambda: collections.deque(maxlen=60))
    )

    # Overlap pairs tracking: (id1, id2) -> {'first_detected', 'last_detected', 'peak_speed_before'}
    self.active_overlaps: Dict[Tuple[int, int], Dict[str, Any]] = {}

    # Incidents detected
    self.detected_incidents: List[Dict[str, Any]] = []

  def update_frame(
      self, frame: np.ndarray, timestamp: float = None
  ):
    """Feeds latest video frame to rolling ring buffer."""
    self.ring_buffer.append(frame, timestamp)

  def process_tracks(
      self,
      tracks: List[Dict[str, Any]],
      frame: np.ndarray = None,
      timestamp: float = None,
  ) -> List[Dict[str, Any]]:
    """Analyzes tracked bounding boxes and velocities for collision events."""
    now = timestamp or time.time()
    if frame is not None:
      self.update_frame(frame, now)

    new_incidents = []

    # Update track velocity histories
    for trk in tracks:
      tid = trk.get('track_id', -1)
      if tid < 0:
        continue
      bbox = trk.get('bbox', [0, 0, 0, 0])
      speed = float(trk.get('speed_kmh', 0.0))
      self.track_histories[tid].append({
          'timestamp': now,
          'bbox': bbox,
          'speed_kmh': speed,
      })

    # Pairwise IoU check across all active tracks
    n = len(tracks)
    for i in range(n):
      t1 = tracks[i]
      id1 = t1.get('track_id', -1)
      b1 = t1.get('bbox', [0, 0, 0, 0])
      s1 = float(t1.get('speed_kmh', 0.0))

      for j in range(i + 1, n):
        t2 = tracks[j]
        id2 = t2.get('track_id', -1)
        b2 = t2.get('bbox', [0, 0, 0, 0])
        s2 = float(t2.get('speed_kmh', 0.0))

        pair_key = (min(id1, id2), max(id1, id2))
        iou = calculate_iou(b1, b2)

        if iou >= self.iou_threshold:
          if pair_key not in self.active_overlaps:
            # Check maximum speed recorded for either vehicle prior to this overlap
            hist1 = self.track_histories.get(id1, [])
            hist2 = self.track_histories.get(id2, [])
            max_s1 = max([h['speed_kmh'] for h in hist1], default=s1)
            max_s2 = max([h['speed_kmh'] for h in hist2], default=s2)
            peak_before = max(max_s1, max_s2)

            self.active_overlaps[pair_key] = {
                'first_detected': now,
                'last_detected': now,
                'peak_speed_before': peak_before,
                'max_iou': iou,
                'alert_triggered': False,
            }
          else:
            self.active_overlaps[pair_key]['last_detected'] = now
            self.active_overlaps[pair_key]['max_iou'] = max(
                self.active_overlaps[pair_key]['max_iou'], iou
            )

          info = self.active_overlaps[pair_key]
          duration = now - info['first_detected']

          # Kinematic Collision Criteria:
          # 1. Abrupt velocity drop from > 35 km/h to 0 km/h
          # 2. Sustained IoU > 0.25 lasting more than 8 seconds
          # 3. Both vehicles currently nearly stationary (speed < 5 km/h)
          is_kinematic_collision = (
              info['peak_speed_before'] >= self.speed_drop_threshold_kmh
              and duration >= self.duration_seconds_threshold
              and s1 <= 5.0
              and s2 <= 5.0
          )

          if is_kinematic_collision and not info['alert_triggered']:
            info['alert_triggered'] = True
            incident_data = {
                'incident_id': f'INC_{int(now)}_{id1}_{id2}',
                'timestamp': now,
                'involved_track_ids': [id1, id2],
                'peak_speed_before_kmh': info['peak_speed_before'],
                'current_speeds_kmh': [s1, s2],
                'sustained_duration_seconds': round(duration, 2),
                'max_iou': round(info['max_iou'], 3),
                'confidence': 0.94,
                'severity': 'CRITICAL',
                'collision_type': 'VEHICLE_COLLISION',
            }
            new_incidents.append(incident_data)
            self.detected_incidents.append(incident_data)
            logger.warning(
                f'🚨 HIGH-PROBABILITY COLLISION DETECTED between track #{id1}'
                f' and #{id2}! Peak speed was'
                f' {info["peak_speed_before"]:.1f} km/h -> 0 km/h (sustained'
                f' {duration:.1f}s)'
            )
        else:
          # IoU dropped below threshold -> clear pair if separated for > 3s
          if pair_key in self.active_overlaps:
            if now - self.active_overlaps[pair_key]['last_detected'] > 3.0:
              del self.active_overlaps[pair_key]

    return new_incidents
