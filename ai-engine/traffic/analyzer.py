import numpy as np
import logging

logger = logging.getLogger(__name__)

class TrafficAnalyzer:
    """
    Traffic Metrics & Analytics Engine.
    Calculates Flow Rate (vehicles/hour), Traffic Density Level, and Congestion Level.
    """

    def __init__(self, density_thresholds=None, congestion_thresholds=None):
        self.density_thresholds = density_thresholds or {
            'low_max': 5,
            'moderate_max': 15,
            'high_max': 25
        }
        self.congestion_thresholds = congestion_thresholds or {
            'severe_speed_below': 15.0,
            'high_speed_below': 30.0,
            'moderate_speed_below': 45.0
        }

    def calculate_flow_rate(self, vehicle_count, interval_seconds):
        """
        Calculate traffic flow rate in vehicles/hour over the time window.
        """
        if interval_seconds <= 0:
            return 0.0
        flow_vph = (vehicle_count / float(interval_seconds)) * 3600.0
        return round(flow_vph, 1)

    def determine_density_level(self, active_vehicle_count):
        """
        Classify traffic density level based on active vehicles inside ROI.
        Levels: LOW, MODERATE, HIGH, VERY_HIGH
        """
        count = int(active_vehicle_count)
        if count <= self.density_thresholds.get('low_max', 5):
            return "LOW"
        elif count <= self.density_thresholds.get('moderate_max', 15):
            return "MODERATE"
        elif count <= self.density_thresholds.get('high_max', 25):
            return "HIGH"
        else:
            return "VERY_HIGH"

    def determine_congestion_level(self, avg_speed_kmh, density_level):
        """
        Rule-based decision logic for traffic congestion level.
        Levels: LOW, MODERATE, HIGH, SEVERE
        """
        speed = float(avg_speed_kmh)
        sev_thresh = self.congestion_thresholds.get('severe_speed_below', 15.0)
        high_thresh = self.congestion_thresholds.get('high_speed_below', 30.0)
        mod_thresh = self.congestion_thresholds.get('moderate_speed_below', 45.0)

        # Crawling / Gridlock Traffic (< 15 km/h)
        if speed < sev_thresh:
            if density_level in ["HIGH", "VERY_HIGH"]:
                return "SEVERE"
            elif density_level == "MODERATE":
                return "HIGH"
            else:
                return "MODERATE"

        # Slow-moving Congested Traffic (15 - 30 km/h)
        elif speed < high_thresh:
            if density_level in ["HIGH", "VERY_HIGH"]:
                return "HIGH"
            else:
                return "MODERATE"

        # Moderate Speed Traffic (30 - 45 km/h)
        elif speed < mod_thresh:
            if density_level in ["HIGH", "VERY_HIGH"]:
                return "MODERATE"
            else:
                return "LOW"

        # Free Flowing Traffic (>= 45 km/h)
        else:
            if density_level in ["VERY_HIGH"]:
                return "MODERATE"
            else:
                return "LOW"

    def aggregate_reading(self, interval_seconds, new_crossings, active_in_roi, speeds):
        """
        Aggregate window reading.
        returns dict:
        {
            'vehicles_counted_window': int,
            'traffic_flow_vph': float,
            'density_level': str,
            'average_speed_kmh': float,
            'congestion_level': str
        }
        """
        valid_speeds = [s for s in speeds if s > 0.0]
        avg_speed = float(np.mean(valid_speeds)) if len(valid_speeds) > 0 else 0.0

        flow_vph = self.calculate_flow_rate(new_crossings, interval_seconds)
        density = self.determine_density_level(active_in_roi)
        congestion = self.determine_congestion_level(avg_speed, density)

        return {
            'vehicles_counted_window': new_crossings,
            'traffic_flow_vph': flow_vph,
            'density_level': density,
            'average_speed_kmh': round(avg_speed, 1),
            'congestion_level': congestion
        }
