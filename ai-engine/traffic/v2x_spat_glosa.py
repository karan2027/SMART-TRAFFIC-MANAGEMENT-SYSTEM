import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("V2X_SPaT_GLOSA")

class V2XSPaTGLOSA:
    """
    Stage 3: V2X Signal Phase and Timing (SPaT) & GLOSA Advisory Engine.
    Broadcasts real-time phase countdowns to connected vehicle dashboards and navigation apps.
    Calculates Green Light Optimal Speed Advisory (GLOSA) to smooth acceleration and eliminate stops.
    """

    def __init__(self, speed_limit_kmh: float = 60.0, min_speed_kmh: float = 20.0):
        self.speed_limit_kmh = speed_limit_kmh
        self.min_speed_kmh = min_speed_kmh

    def calculate_glosa_speed(
        self,
        distance_to_stop_line_meters: float,
        current_signal_state: str,
        remaining_phase_seconds: float,
        next_green_delay_seconds: float = 0.0
    ) -> Dict[str, Any]:
        """
        GLOSA Formula:
        If Signal is currently GREEN:
          Target: cross before green ends (within remaining_phase_seconds - 2.0s safety margin).
          v = distance / t
        If Signal is currently RED:
          Target: arrive exactly as signal turns green (after next_green_delay_seconds).
          v = distance / next_green_delay
        """
        d = max(10.0, float(distance_to_stop_line_meters))
        rem = max(1.0, float(remaining_phase_seconds))

        if current_signal_state == "GREEN":
            if rem > 3.0:
                # Time to cross safely
                target_time = max(2.0, rem - 1.5)
                target_speed_mps = d / target_time
                target_speed_kmh = target_speed_mps * 3.6

                clamped_speed = min(self.speed_limit_kmh, max(self.min_speed_kmh, target_speed_kmh))
                advice = f"Cruise at {clamped_speed:.0f} km/h to pass green wave safely"
                action = "MAINTAIN_SPEED"
            else:
                # Green expiring very soon -> prepare to stop
                clamped_speed = self.min_speed_kmh
                advice = "Signal turning Yellow shortly; prepare to decelerate safely"
                action = "PREPARE_TO_STOP"
        else: # RED or YELLOW
            time_to_green = max(3.0, next_green_delay_seconds if next_green_delay_seconds > 0 else rem)
            target_speed_mps = d / time_to_green
            target_speed_kmh = target_speed_mps * 3.6
            clamped_speed = min(self.speed_limit_kmh * 0.75, max(self.min_speed_kmh, target_speed_kmh))
            advice = f"Coast at {clamped_speed:.0f} km/h to arrive on green without stopping"
            action = "COAST_DECELERATE"

        return {
            "distance_meters": round(d, 1),
            "signal_state": current_signal_state,
            "remaining_seconds": round(rem, 1),
            "recommended_glosa_speed_kmh": round(clamped_speed, 1),
            "driver_action": action,
            "advisory_message": advice
        }

    def generate_spat_packet(
        self,
        junction_id: str,
        active_direction: str,
        current_phase_state: str,
        remaining_seconds: float,
        distance_meters: float = 150.0
    ) -> Dict[str, Any]:
        """Generates standard SPaT broadcast payload."""
        is_green = "GREEN" in current_phase_state
        glosa = self.calculate_glosa_speed(
            distance_to_stop_line_meters=distance_meters,
            current_signal_state="GREEN" if is_green else "RED",
            remaining_phase_seconds=remaining_seconds
        )

        return {
            "protocol": "V2X_SPAT_SAE_J2735",
            "junction_id": junction_id,
            "timestamp": time.time(),
            "active_phase": {
                "direction": active_direction,
                "phase_state": current_phase_state,
                "remaining_seconds": round(remaining_seconds, 1)
            },
            "glosa_advisory": glosa
        }
