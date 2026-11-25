import cv2
import numpy as np
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger("EmergencyDetector")

class EmergencyVehicleDetector:
    """
    Stage 2: Emergency Vehicle Detection & Classification Module.
    Classifies Ambulances, Fire Trucks, and Police Vehicles using multi-spectral
    color signature analysis, roof strobe/beacon detection, and livery contrast patterns.
    """

    def __init__(self, confidence_threshold: float = 0.70):
        self.confidence_threshold = confidence_threshold
        # Simulated emergency flags for testing & examiner viva demos
        self.simulated_emergencies: Dict[str, Dict[str, Any]] = {}

    def set_simulated_emergency(self, approach: str, vehicle_type: str = "AMBULANCE", duration_seconds: float = 30.0):
        """Allows injecting an emergency vehicle on an approach for live demos."""
        import time
        app = approach.upper()
        self.simulated_emergencies[app] = {
            "vehicle_type": vehicle_type.upper(),
            "expires_at": time.time() + duration_seconds
        }
        logger.info(f"🚨 Simulated Emergency injected on approach {app}: {vehicle_type} (duration: {duration_seconds}s)")

    def clear_simulated_emergency(self, approach: Optional[str] = None):
        if approach:
            self.simulated_emergencies.pop(approach.upper(), None)
        else:
            self.simulated_emergencies.clear()

    def is_simulated_active(self, approach: str) -> Optional[str]:
        import time
        app = approach.upper()
        if app in self.simulated_emergencies:
            info = self.simulated_emergencies[app]
            if time.time() < info["expires_at"]:
                return info["vehicle_type"]
            else:
                del self.simulated_emergencies[app]
        return None

    def analyze_crop(self, crop: np.ndarray) -> Dict[str, Any]:
        """
        Analyzes a cropped vehicle image:
        1. Evaluates roof beacon / emergency lightbar in upper 25% of vehicle.
        2. Measures HSV color density for Fire Truck Red, Ambulance Medical White/Red, and Police Blue.
        """
        if crop is None or crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 20:
            return {
                "is_emergency": False,
                "vehicle_type": "NONE",
                "confidence": 0.0,
                "reasons": []
            }

        h, w = crop.shape[:2]
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

        # Upper 30% region where rooftop emergency beacons / lightbars are mounted
        roof_region = hsv[:max(6, int(h * 0.30)), :]

        # 1. Red Mask (covers H in [0, 10] and [165, 180])
        lower_red1 = np.array([0, 100, 90], dtype=np.uint8)
        upper_red1 = np.array([10, 255, 255], dtype=np.uint8)
        lower_red2 = np.array([165, 100, 90], dtype=np.uint8)
        upper_red2 = np.array([180, 255, 255], dtype=np.uint8)
        mask_red = cv2.bitwise_or(
            cv2.inRange(hsv, lower_red1, upper_red1),
            cv2.inRange(hsv, lower_red2, upper_red2)
        )
        red_ratio = float(np.count_nonzero(mask_red)) / float(h * w)

        # Roof beacon red
        roof_red_mask = cv2.bitwise_or(
            cv2.inRange(roof_region, lower_red1, upper_red1),
            cv2.inRange(roof_region, lower_red2, upper_red2)
        )
        roof_red_ratio = float(np.count_nonzero(roof_red_mask)) / float(roof_region.shape[0] * roof_region.shape[1])

        # 2. Blue Mask (covers H in [100, 135] for emergency beacons)
        lower_blue = np.array([100, 120, 100], dtype=np.uint8)
        upper_blue = np.array([135, 255, 255], dtype=np.uint8)
        roof_blue_mask = cv2.inRange(roof_region, lower_blue, upper_blue)
        roof_blue_ratio = float(np.count_nonzero(roof_blue_mask)) / float(roof_region.shape[0] * roof_region.shape[1])

        # 3. White / High-Value Mask (Ambulance base body)
        lower_white = np.array([0, 0, 190], dtype=np.uint8)
        upper_white = np.array([180, 45, 255], dtype=np.uint8)
        mask_white = cv2.inRange(hsv, lower_white, upper_white)
        white_ratio = float(np.count_nonzero(mask_white)) / float(h * w)

        # 4. Classification Decision Logic
        reasons = []

        # Case A: Fire Truck (Dominant High-Intensity Red Body >= 30% + Roof Beacon)
        if red_ratio >= 0.30:
            reasons.append(f"dominant_red_body_{round(red_ratio*100)}pct")
            confidence = min(0.96, 0.65 + (red_ratio * 0.7) + (roof_red_ratio * 0.5))
            if roof_red_ratio > 0.05 or roof_blue_ratio > 0.05:
                reasons.append("roof_beacon_detected")
                confidence = min(0.98, confidence + 0.10)

            if confidence >= self.confidence_threshold:
                return {
                    "is_emergency": True,
                    "vehicle_type": "FIRE_TRUCK",
                    "confidence": round(confidence, 3),
                    "reasons": reasons
                }

        # Case B: Ambulance (Dominant White Body + Red/Orange Stripes/Cross + Roof Beacon)
        if white_ratio >= 0.25 and (red_ratio >= 0.06 or roof_red_ratio >= 0.04 or roof_blue_ratio >= 0.04):
            reasons.append(f"ambulance_white_body_{round(white_ratio*100)}pct")
            reasons.append(f"emergency_stripe_cross_{round(red_ratio*100)}pct")
            confidence = min(0.95, 0.60 + (white_ratio * 0.5) + (red_ratio * 0.8))
            if roof_red_ratio > 0.03 or roof_blue_ratio > 0.03:
                reasons.append("ambulance_roof_beacon_detected")
                confidence = min(0.97, confidence + 0.12)

            if confidence >= self.confidence_threshold:
                return {
                    "is_emergency": True,
                    "vehicle_type": "AMBULANCE",
                    "confidence": round(confidence, 3),
                    "reasons": reasons
                }

        # Case C: Police Vehicle (Active Blue Lightbar Beacon on Roof)
        if roof_blue_ratio >= 0.06:
            reasons.append(f"police_blue_beacon_{round(roof_blue_ratio*100)}pct")
            confidence = min(0.94, 0.70 + (roof_blue_ratio * 1.5))
            if confidence >= self.confidence_threshold:
                return {
                    "is_emergency": True,
                    "vehicle_type": "POLICE",
                    "confidence": round(confidence, 3),
                    "reasons": reasons
                }

        return {
            "is_emergency": False,
            "vehicle_type": "NONE",
            "confidence": 0.0,
            "reasons": []
        }

    def detect_in_frame(
        self,
        frame: np.ndarray,
        tracks: list,
        approach: str = "NORTH"
    ) -> Dict[str, Any]:
        """
        Inspects all tracked vehicles in the frame and returns emergency pre-emption metadata.
        """
        # Check simulated test trigger first (for viva/presentation mode)
        sim_type = self.is_simulated_active(approach)
        if sim_type:
            return {
                "detected": True,
                "vehicle_type": sim_type,
                "confidence": 0.99,
                "approach": approach,
                "track_id": 9999,
                "simulated": True,
                "reasons": ["simulated_live_injection"]
            }

        h, w = frame.shape[:2]

        for trk in tracks:
            bbox = trk.get('bbox', [])
            if len(bbox) != 4:
                continue

            x1, y1, x2, y2 = [int(v) for v in bbox]
            # Clamp to frame bounds
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            if (x2 - x1) < 25 or (y2 - y1) < 25:
                continue

            crop = frame[y1:y2, x1:x2]
            analysis = self.analyze_crop(crop)

            if analysis["is_emergency"]:
                logger.warning(
                    f"🚨 [AI DETECTION] {analysis['vehicle_type']} detected on {approach} approach! "
                    f"Confidence: {analysis['confidence']} | Track ID: {trk.get('track_id')}"
                )
                return {
                    "detected": True,
                    "vehicle_type": analysis["vehicle_type"],
                    "confidence": analysis["confidence"],
                    "approach": approach,
                    "track_id": trk.get("track_id"),
                    "simulated": False,
                    "reasons": analysis["reasons"],
                    "bbox": bbox
                }

        return {
            "detected": False,
            "vehicle_type": "NONE",
            "confidence": 0.0,
            "approach": approach,
            "simulated": False
        }
