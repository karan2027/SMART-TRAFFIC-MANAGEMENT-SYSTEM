import time
import math
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("ViolationDetector")

class TrafficViolationDetector:
    """
    Stage 3: Individual Automated Traffic Violation Detectors.
    Implements distinct specialized algorithms for:
    1. Red-Light Jumping (Stop-line crossing verification during RED phase)
    2. Wrong-Side Driving (Trajectory vector heading vs permitted corridor angle)
    3. Helmet Violation (Head detection on two-wheelers)
    4. Triple Riding (Occupant count on single motorcycle > 2)
    5. Overspeeding (Calibrated speed exceeding road limit)
    """

    def __init__(
        self,
        stop_line_y: int = 480,
        permitted_heading_deg: float = 90.0, # Downwards in image coords
        speed_limit_kmh: float = 50.0
    ):
        self.stop_line_y = stop_line_y
        self.permitted_heading_deg = permitted_heading_deg
        self.speed_limit_kmh = speed_limit_kmh

        # History of track centroids for vector direction analysis: track_id -> [(x, y, ts)]
        self.track_positions: Dict[int, List[Tuple[float, float, float]]] = {}
        # Records already flagged violations: (track_id, violation_type)
        self.recorded_violations: set = set()

    def check_red_light_jump(
        self,
        track_id: int,
        current_bbox: List[float],
        previous_bbox: Optional[List[float]],
        current_signal_state: str = "RED"
    ) -> Optional[Dict[str, Any]]:
        """
        Detects red-light jumping:
        Only triggers if vehicle crossed the stop line while the signal phase is strictly RED.
        Does NOT falsely flag vehicles that were already past the line before the phase turned red.
        """
        if current_signal_state != "RED":
            return None

        key = (track_id, "RED_LIGHT_JUMP")
        if key in self.recorded_violations:
            return None

        curr_bottom_y = current_bbox[3]
        prev_bottom_y = previous_bbox[3] if previous_bbox else curr_bottom_y - 10.0

        # Crossing check: previous position was before stop line (< 480), current is past (>= 480)
        crossed_line = (prev_bottom_y < self.stop_line_y and curr_bottom_y >= self.stop_line_y)

        if crossed_line:
            self.recorded_violations.add(key)
            logger.warning(f"🚨 RED LIGHT VIOLATION: Track #{track_id} crossed stop line (Y={curr_bottom_y:.1f}) during RED phase!")
            return {
                "violation_type": "RED_LIGHT_JUMP",
                "track_id": track_id,
                "confidence": 0.96,
                "fine_amount_inr": 2000,
                "evidence_timestamp": time.time(),
                "details": f"Crossed virtual stop line Y={self.stop_line_y} during active RED signal phase"
            }

        return None

    def check_wrong_side(
        self,
        track_id: int,
        current_centroid: Tuple[float, float]
    ) -> Optional[Dict[str, Any]]:
        """
        Detects wrong-side driving by comparing trajectory motion vector angle
        against permitted corridor direction. (Deviation > 120 degrees).
        """
        key = (track_id, "WRONG_SIDE_DRIVING")
        if key in self.recorded_violations:
            return None

        now = time.time()
        if track_id not in self.track_positions:
            self.track_positions[track_id] = []
        self.track_positions[track_id].append((current_centroid[0], current_centroid[1], now))

        history = self.track_positions[track_id]
        if len(history) < 5:
            return None

        # Calculate trajectory vector over last 5 points
        start_x, start_y, _ = history[-5]
        end_x, end_y, _ = history[-1]
        dx = end_x - start_x
        dy = end_y - start_y
        displacement = math.hypot(dx, dy)

        if displacement < 25.0: # Filter small jitter
            return None

        # Heading angle in degrees (0 to 360)
        heading_rad = math.atan2(dy, dx)
        heading_deg = (math.degrees(heading_rad) + 360.0) % 360.0

        # Angular difference
        diff = abs(heading_deg - self.permitted_heading_deg)
        if diff > 180.0:
            diff = 360.0 - diff

        if diff > 120.0: # Moving in opposite prohibited direction
            self.recorded_violations.add(key)
            logger.warning(f"🚨 WRONG-WAY DRIVING: Track #{track_id} heading {heading_deg:.1f}° vs permitted {self.permitted_heading_deg:.1f}°!")
            return {
                "violation_type": "WRONG_SIDE_DRIVING",
                "track_id": track_id,
                "confidence": 0.93,
                "heading_degrees": round(heading_deg, 1),
                "permitted_heading_degrees": round(self.permitted_heading_deg, 1),
                "fine_amount_inr": 1500,
                "details": f"Trajectory heading angle deviated by {diff:.1f}° against one-way traffic flow"
            }

        return None

    def check_two_wheeler_violations(
        self,
        track_id: int,
        vehicle_class: str,
        rider_count: int = 1,
        has_helmet: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Detects helmet violation and triple riding on motorcycles/two-wheelers.
        """
        violations = []
        is_motorcycle = any(k in vehicle_class.lower() for k in ["motorcycle", "bike", "two_wheeler", "scooter"])
        if not is_motorcycle:
            return violations

        # Check Triple Riding (Rider count > 2)
        if rider_count > 2:
            key = (track_id, "TRIPLE_RIDING")
            if key not in self.recorded_violations:
                self.recorded_violations.add(key)
                violations.append({
                    "violation_type": "TRIPLE_RIDING",
                    "track_id": track_id,
                    "confidence": 0.91,
                    "rider_count": rider_count,
                    "fine_amount_inr": 1000,
                    "details": f"Motorcycle carrying {rider_count} occupants (legal maximum: 2)"
                })

        # Check Helmet Violation
        if not has_helmet:
            key = (track_id, "HELMET_VIOLATION")
            if key not in self.recorded_violations:
                self.recorded_violations.add(key)
                violations.append({
                    "violation_type": "HELMET_VIOLATION",
                    "track_id": track_id,
                    "confidence": 0.89,
                    "fine_amount_inr": 1000,
                    "details": "Rider observed operating two-wheeler without mandatory protective helmet"
                })

        return violations

    def check_overspeeding(
        self,
        track_id: int,
        calibrated_speed_kmh: float
    ) -> Optional[Dict[str, Any]]:
        """
        Detects speed violations above calibrated limit.
        """
        key = (track_id, "OVERSPEEDING")
        if key in self.recorded_violations:
            return None

        # 10% enforcement tolerance margin
        if calibrated_speed_kmh > (self.speed_limit_kmh * 1.10):
            self.recorded_violations.add(key)
            return {
                "violation_type": "OVERSPEEDING",
                "track_id": track_id,
                "confidence": 0.95,
                "measured_speed_kmh": round(calibrated_speed_kmh, 1),
                "speed_limit_kmh": round(self.speed_limit_kmh, 1),
                "fine_amount_inr": 2000,
                "details": f"Speed measured at {calibrated_speed_kmh:.1f} km/h on a {self.speed_limit_kmh:.0f} km/h corridor"
            }

        return None
