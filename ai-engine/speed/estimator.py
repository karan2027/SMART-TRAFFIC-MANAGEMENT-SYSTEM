import numpy as np
import logging

logger = logging.getLogger(__name__)

class SpeedEstimator:
    """
    Speed Estimator with 2-Point Perspective Calibration.
    Calculates vehicle velocity in km/h based on real-world reference distance (meters) vs pixel distance.
    If calibration is disabled or unverified, labels values as 'estimated'.
    """

    def __init__(self, is_calibrated=True, reference_distance_meters=20.0, calibration_points=None, fps=30.0):
        """
        calibration_points: [(x1, y1), (x2, y2)] absolute pixel coordinates representing reference_distance_meters
        fps: Video frames per second
        """
        self.is_calibrated = is_calibrated
        self.reference_distance_meters = float(reference_distance_meters)
        self.fps = float(fps) if fps > 0 else 30.0
        self.dt = 1.0 / self.fps

        self.pixels_per_meter = 15.0 # default baseline estimate
        if calibration_points and len(calibration_points) == 2:
            p1 = np.array(calibration_points[0], dtype=np.float32)
            p2 = np.array(calibration_points[1], dtype=np.float32)
            pixel_distance = np.linalg.norm(p1 - p2)
            if pixel_distance > 1.0:
                self.pixels_per_meter = pixel_distance / self.reference_distance_meters
                logger.info(f"Speed Estimator calibrated: {self.pixels_per_meter:.2f} pixels/meter ({self.reference_distance_meters}m reference)")

        self.track_positions = {} # track_id -> list of (frame_idx, (x, y))
        self.stationary_frames = {} # track_id -> consecutive frames near zero speed
        self.stationary_track_ids = set() # currently stationary in scene
        self.all_ever_stationary_ids = set() # total stationary unique vehicles observed

    def estimate_speed(self, track_id, current_frame_idx, current_centroid):
        """
        Estimate speed for a vehicle track_id.
        Detects stationary/stopped vehicles in queue or breakdown.
        Returns dict:
        {
            'speed_kmh': float,
            'is_calibrated': bool,
            'status': str ('measured' or 'estimated'),
            'is_stationary': bool
        }
        """
        if track_id not in self.track_positions:
            self.track_positions[track_id] = [(current_frame_idx, current_centroid)]
            return {
                'speed_kmh': 0.0,
                'is_calibrated': self.is_calibrated,
                'status': 'measured' if self.is_calibrated else 'estimated',
                'is_stationary': False
            }

        history = self.track_positions[track_id]
        history.append((current_frame_idx, current_centroid))

        # Keep max 15 frames history for smooth moving average
        if len(history) > 15:
            history.pop(0)

        if len(history) < 3:
            return {
                'speed_kmh': 0.0,
                'is_calibrated': self.is_calibrated,
                'status': 'measured' if self.is_calibrated else 'estimated',
                'is_stationary': False
            }

        # Calculate speed over recent time delta (e.g. 5-10 frames)
        prev_frame, prev_pos = history[0]
        curr_frame, curr_pos = history[-1]

        frame_delta = curr_frame - prev_frame
        if frame_delta <= 0:
            return {
                'speed_kmh': 0.0,
                'is_calibrated': self.is_calibrated,
                'status': 'measured' if self.is_calibrated else 'estimated',
                'is_stationary': False
            }

        time_delta_seconds = frame_delta * self.dt
        pixel_distance = np.linalg.norm(np.array(curr_pos) - np.array(prev_pos))

        meters_traveled = pixel_distance / self.pixels_per_meter
        speed_mps = meters_traveled / time_delta_seconds
        speed_kmh = speed_mps * 3.6 # m/s to km/h

        # Cap realistic bound (0 to 180 km/h)
        speed_kmh = max(0.0, min(180.0, float(speed_kmh)))
        rounded_speed = round(speed_kmh, 1)

        # Stationary Vehicle Detection: Speed below 3.0 km/h for >= 20 frames (approx 0.7-1.0s)
        if rounded_speed <= 3.0:
            self.stationary_frames[track_id] = self.stationary_frames.get(track_id, 0) + frame_delta
        else:
            self.stationary_frames[track_id] = max(0, self.stationary_frames.get(track_id, 0) - frame_delta * 2)

        is_stationary = self.stationary_frames.get(track_id, 0) >= 20
        if is_stationary:
            self.stationary_track_ids.add(track_id)
            self.all_ever_stationary_ids.add(track_id)
        else:
            self.stationary_track_ids.discard(track_id)

        return {
            'speed_kmh': rounded_speed,
            'is_calibrated': self.is_calibrated,
            'status': 'measured' if self.is_calibrated else 'estimated',
            'is_stationary': is_stationary
        }

    def get_stationary_stats(self):
        return {
            'active_stationary_count': len(self.stationary_track_ids),
            'total_stationary_detected': len(self.all_ever_stationary_ids)
        }
