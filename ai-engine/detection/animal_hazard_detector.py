import time
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("AnimalHazardDetector")

class AnimalHazardDetector:
    """
    Stage 3: Stray Animal & Cattle Hazard Management (Indian Road Context).
    Detects stray cattle, dogs, horses, and sheep on carriageways.
    Enforces metric isolation so animals never corrupt vehicle queue math.
    Executes tiered signal responses: All-Red pause (moving) or Flashing Amber (sitting cattle >30s).
    """

    COCO_ANIMAL_CLASSES = {
        16: "dog",
        17: "horse",
        18: "sheep",
        19: "cow"
    }

    def __init__(
        self,
        confidence_threshold: float = 0.55,
        persistence_frames_threshold: int = 12,
        stationary_timeout_seconds: float = 30.0
    ):
        self.conf_threshold = confidence_threshold
        self.persistence_frames = persistence_frames_threshold
        self.stationary_timeout = stationary_timeout_seconds

        # Track history for animal detections: key -> {'class', 'frames', 'first_seen', 'last_seen', 'stationary_since', 'bbox', 'mitigation'}
        self.active_hazards: Dict[str, Dict[str, Any]] = {}

    def filter_raw_detections(self, detections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        CRITICAL METRIC ISOLATION:
        Splits raw YOLO detections into:
        1. vehicular_detections: standard cars, motorcycles, buses, trucks (passed to Webster math)
        2. animal_detections: stray livestock (isolated completely from vehicle queue math)
        """
        vehicular = []
        animals = []

        for det in detections:
            cls_id = det.get('class_id')
            cls_name = det.get('class_name', '').lower()
            conf = float(det.get('confidence', 0.0))

            if cls_id in self.COCO_ANIMAL_CLASSES or cls_name in ["cow", "dog", "horse", "sheep", "cattle"]:
                if conf >= self.conf_threshold:
                    animals.append(det)
            else:
                vehicular.append(det)

        return vehicular, animals

    def update(self, animal_detections: List[Dict[str, Any]], current_time: float = None) -> List[Dict[str, Any]]:
        """
        Updates persistent observation counters and generates tiered signal mitigation events.
        """
        now = current_time or time.time()
        triggered_events = []

        seen_keys = set()
        for idx, det in enumerate(animal_detections):
            cls_name = det.get('class_name', 'cow').lower()
            bbox = det.get('bbox', [0, 0, 0, 0])
            key = f"{cls_name}_{int(bbox[0]/50)}_{int(bbox[1]/50)}"
            seen_keys.add(key)

            if key not in self.active_hazards:
                self.active_hazards[key] = {
                    "hazard_id": f"HAZ_{int(now)}_{key}",
                    "animal_class": cls_name.upper(),
                    "consecutive_frames": 1,
                    "first_seen": now,
                    "last_seen": now,
                    "stationary_since": now,
                    "last_bbox": bbox,
                    "is_stationary": False,
                    "alert_emitted": False,
                    "mitigation": "NORMAL"
                }
            else:
                info = self.active_hazards[key]
                info["consecutive_frames"] += 1
                info["last_seen"] = now

                # Movement check (if centroid shifted < 15 pixels, considered stationary)
                old_box = info["last_bbox"]
                old_center = ((old_box[0] + old_box[2]) / 2, (old_box[1] + old_box[3]) / 2)
                new_center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
                displacement = ((new_center[0] - old_center[0])**2 + (new_center[1] - old_center[1])**2)**0.5
                info["last_bbox"] = bbox

                if displacement < 15.0:
                    time_stationary = now - info["stationary_since"]
                    info["is_stationary"] = True
                else:
                    info["stationary_since"] = now
                    info["is_stationary"] = False
                    time_stationary = 0.0

                # Multi-frame persistence threshold passed
                if info["consecutive_frames"] >= self.persistence_frames:
                    # Tiered Signal Mitigation:
                    # Case A: Stationary sitting cattle > 30s timeout -> Flashing Amber caution
                    # Case B: Moving animal crossing -> 10-15s All-Red caution pause
                    if info["is_stationary"] and time_stationary >= self.stationary_timeout:
                        mitigation = "FLASHING_AMBER_PROCEED_WITH_CAUTION"
                        state_label = "STATIONARY_OBSTRUCTION"
                    else:
                        mitigation = "ALL_RED_CAUTION_PAUSE"
                        state_label = "MOVING_CROSSING"

                    if not info["alert_emitted"] or info["mitigation"] != mitigation:
                        info["alert_emitted"] = True
                        info["mitigation"] = mitigation
                        event = {
                            "hazard_id": info["hazard_id"],
                            "animal_class": info["animal_class"],
                            "confidence": round(det.get("confidence", 0.85), 3),
                            "consecutive_frames": info["consecutive_frames"],
                            "hazard_state": state_label,
                            "signal_mitigation": mitigation,
                            "stationary_duration_seconds": round(time_stationary, 1) if info["is_stationary"] else 0.0,
                            "bbox": bbox
                        }
                        triggered_events.append(event)
                        logger.warning(f"🐄 ANIMAL HAZARD ACTIVE: {info['animal_class']} ({state_label}) -> Signal Mitigation: {mitigation}")

        # Clean stale hazard tracks
        for key in list(self.active_hazards.keys()):
            if key not in seen_keys:
                if now - self.active_hazards[key]["last_seen"] > 4.0:
                    del self.active_hazards[key]

        return triggered_events
