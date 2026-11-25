import cv2
import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("PedestrianSafetyDetector")

class PedestrianSafetyDetector:
    """
    Stage 3: Vulnerable Pedestrian Crossing Safety & Dynamic Walk-Phase Extension.
    Monitors crosswalk Regions of Interest (ROIs), counts waiting and crossing pedestrians,
    and calculates necessary walk-phase extensions to safeguard slow/elderly pedestrians.
    """

    def __init__(self, crosswalk_roi: Optional[List[Tuple[int, int]]] = None):
        # Default crosswalk ROI polygon coordinates (in a 1280x720 scene)
        self.crosswalk_roi = crosswalk_roi or [
            (200, 500),
            (1080, 500),
            (1150, 680),
            (130, 680)
        ]
        self.roi_polygon = np.array(self.crosswalk_roi, dtype=np.int32)

    def is_point_in_crosswalk(self, point: Tuple[float, float]) -> bool:
        """Point-in-polygon test using OpenCV."""
        return cv2.pointPolygonTest(self.roi_polygon, (float(point[0]), float(point[1])), False) >= 0

    def analyze_pedestrians(
        self,
        detections: List[Dict[str, Any]],
        current_signal_remaining_seconds: int = 10,
        current_signal_state: str = "GREEN"
    ) -> Dict[str, Any]:
        """
        Processes pedestrian detections (COCO Class 0):
        1. Classifies pedestrians inside crosswalk ROI vs waiting on sidewalks.
        2. If pedestrian timer is low (<= 5s) and pedestrians are still in ROI, triggers extension.
        3. Sets turning conflict suppression flag to hold free-left/right vehicular turns.
        """
        inside_crosswalk = 0
        waiting_on_sidewalk = 0

        for det in detections:
            cls_name = det.get('class_name', '').lower()
            cls_id = det.get('class_id', -1)

            if cls_id == 0 or 'person' in cls_name or 'pedestrian' in cls_name:
                bbox = det.get('bbox', [0, 0, 0, 0])
                bottom_center = ((bbox[0] + bbox[2]) / 2.0, bbox[3])

                if self.is_point_in_crosswalk(bottom_center):
                    inside_crosswalk += 1
                else:
                    # Near crosswalk
                    waiting_on_sidewalk += 1

        is_crosswalk_occupied = inside_crosswalk > 0
        extension_seconds = 0

        # Dynamic Walk-Phase Extension Logic:
        # If pedestrians are still crossing when signal clearance is expiring (<= 5s), extend by 5-10s
        if is_crosswalk_occupied and current_signal_remaining_seconds <= 5:
            # 5s base extension + 1s per 2 pedestrians up to 10s max
            extension_seconds = min(10, 5 + int(inside_crosswalk / 2))
            logger.info(f"🚶 Pedestrians in crosswalk ({inside_crosswalk}). Extending walk clearance by {extension_seconds}s.")

        return {
            "crosswalk_occupied": is_crosswalk_occupied,
            "pedestrians_in_crosswalk": inside_crosswalk,
            "waiting_on_sidewalk": waiting_on_sidewalk,
            "dynamic_walk_extension_seconds": extension_seconds,
            "turning_conflict_suppressed": is_crosswalk_occupied
        }
