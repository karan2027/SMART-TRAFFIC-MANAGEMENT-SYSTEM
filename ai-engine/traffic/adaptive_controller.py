import time
import math
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("AdaptiveController")

class AdaptiveSignalController:
    """
    Stage 2: 4-Way Intersection Adaptive Signal Controller.
    Implements Webster's Traffic Delay Optimization, Dynamic Green Time Allocation,
    Phase Transition State Machine, and Advanced Emergency Vehicle Pre-emption.
    """

    def __init__(
        self,
        min_green: int = 15,
        max_green: int = 75,
        yellow_time: int = 4,
        all_red_time: int = 2,
        target_cycle: int = 120,
        saturation_flow_rate_vph: float = 1800.0,
        lost_time_per_phase: float = 3.0
    ):
        self.min_green = min_green
        self.max_green = max_green
        self.yellow_time = yellow_time
        self.all_red_time = all_red_time
        self.target_cycle = target_cycle
        self.saturation_flow_rate = saturation_flow_rate_vph
        self.lost_time_per_phase = lost_time_per_phase

        self.directions = ["NORTH", "SOUTH", "EAST", "WEST"]
        
        # State Machine Variables
        self.active_direction = "NORTH"
        # Phases: GREEN_ACTIVE, YELLOW_CLEARANCE, ALL_RED_CLEARANCE,
        #         EMERGENCY_YELLOW_CLEARANCE, EMERGENCY_ALL_RED, EMERGENCY_GREEN_CORRIDOR
        self.phase_state = "GREEN_ACTIVE"
        self.current_phase_start = time.time()
        self.current_phase_duration = min_green
        self.cycle_count = 0

        # Current allocated green times per approach
        self.allocated_green = {d: min_green for d in self.directions}

        # Emergency Pre-emption State
        self.emergency_active = False
        self.emergency_approach: Optional[str] = None
        self.emergency_vehicle_type: Optional[str] = None
        self.emergency_started_at: Optional[float] = None
        self.interrupted_direction: Optional[str] = None
        self.interrupted_remaining: int = 0

    def calculate_webster_allocations(self, approach_telemetry: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates optimal cycle length and allocated green duration per approach
        using Webster's Method adapted for real-time queue length & arrival rates.

        Formula:
          Co = (1.5 * L + 5) / (1 - Y)
          gi = (yi / Y) * (Co - L)
        """
        queue_counts = {}
        flow_rates = {}
        y_ratios = {}

        total_lost_time = len(self.directions) * self.lost_time_per_phase

        for d in self.directions:
            data = approach_telemetry.get(d, {})
            q_count = max(0, int(data.get("queueCount", data.get("activeVehicles", 0))))
            queue_counts[d] = q_count

            flow = max(0.0, float(data.get("flowRateVph", 0.0)))
            effective_flow = flow if flow > 0 else (q_count * 150.0)
            flow_rates[d] = effective_flow

            y_i = effective_flow / self.saturation_flow_rate
            y_ratios[d] = max(0.05, y_i)

        total_y = sum(y_ratios.values())
        clamped_y = min(0.85, max(0.20, total_y))

        co = (1.5 * total_lost_time + 5.0) / (1.0 - clamped_y)
        optimal_cycle = int(round(min(150, max(60, co))))

        available_green = optimal_cycle - (len(self.directions) * (self.yellow_time + self.all_red_time))
        available_green = max(len(self.directions) * self.min_green, available_green)

        allocations = {}
        total_weight = sum(
            (0.6 * (queue_counts[d] + 1)) + (0.4 * (y_ratios[d] * 100))
            for d in self.directions
        )

        for d in self.directions:
            weight = (0.6 * (queue_counts[d] + 1)) + (0.4 * (y_ratios[d] * 100))
            ratio = weight / total_weight if total_weight > 0 else 0.25
            green_time = int(round(ratio * available_green))
            allocations[d] = max(self.min_green, min(self.max_green, green_time))

        self.allocated_green = allocations

        return {
            "optimalCycleSeconds": optimal_cycle,
            "totalSaturationRatio": round(total_y, 3),
            "allocatedGreenSeconds": allocations,
            "queueCounts": queue_counts
        }

    def trigger_emergency_preemption(
        self,
        approach: str,
        vehicle_type: str = "AMBULANCE",
        corridor_duration: int = 45
    ) -> Dict[str, Any]:
        """
        Activates Priority Emergency Pre-emption on designated approach.
        Safety Invariant:
        - If target approach is already GREEN, its green is extended.
        - If another approach is active, transitions smoothly through fast Emergency Yellow (3s)
          and Emergency All-Red (1.5s) clearance before forcing the Green Corridor.
        """
        app = approach.upper()
        if app not in self.directions:
            raise ValueError(f"Invalid approach: {approach}. Allowed: {self.directions}")

        logger.warning(f"🚨 EMERGENCY PRE-EMPTION TRIGGERED on approach {app} for {vehicle_type}!")
        now = time.time()

        self.emergency_active = True
        self.emergency_approach = app
        self.emergency_vehicle_type = vehicle_type
        self.emergency_started_at = now

        # Case 1: Target approach is already active GREEN
        if self.active_direction == app and self.phase_state in ["GREEN_ACTIVE", "EMERGENCY_GREEN_CORRIDOR"]:
            self.phase_state = "EMERGENCY_GREEN_CORRIDOR"
            self.current_phase_duration = corridor_duration
            self.current_phase_start = now
            logger.info(f"Approach {app} already GREEN. Extended emergency green corridor for {corridor_duration}s.")
        else:
            # Case 2: Another approach was active. Store interrupted state to resume fairly later.
            self.interrupted_direction = self.active_direction
            elapsed = now - self.current_phase_start
            self.interrupted_remaining = max(5, int(round(self.current_phase_duration - elapsed)))

            # Initiate safe Emergency Yellow transition for the currently active direction
            self.phase_state = "EMERGENCY_YELLOW_CLEARANCE"
            self.current_phase_duration = 3.0  # 3s fast clearance yellow
            self.current_phase_start = now
            logger.info(f"Halting {self.interrupted_direction} via EMERGENCY_YELLOW_CLEARANCE (3s) before granting {app} Green Corridor.")

        return self.get_current_signal_states()

    def clear_emergency_preemption(self) -> Dict[str, Any]:
        """
        Clears emergency pre-emption and smoothly resumes normal cycle via safety ALL_RED clearance.
        """
        logger.info("✅ Emergency pre-emption cleared. Resuming adaptive signal cycle.")
        now = time.time()
        self.emergency_active = False
        self.emergency_approach = None
        self.emergency_vehicle_type = None
        self.emergency_started_at = None

        # Transition safely via ALL_RED_CLEARANCE before regular cycle starts
        self.phase_state = "ALL_RED_CLEARANCE"
        self.current_phase_duration = self.all_red_time
        self.current_phase_start = now

        return self.get_current_signal_states()

    def tick(self, approach_telemetry: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Executes one second of the traffic controller state machine:
        - Handles countdown decrements
        - Manages clearance intervals & emergency green transitions
        - Automatically clears timed-out emergency corridors
        """
        now = time.time()
        elapsed = now - self.current_phase_start
        remaining = max(0, int(round(self.current_phase_duration - elapsed)))

        # ----------------------------------------------------
        # EMERGENCY PHASES
        # ----------------------------------------------------
        if self.emergency_active:
            if self.phase_state == "EMERGENCY_YELLOW_CLEARANCE":
                if remaining <= 0:
                    # Transition Emergency Yellow -> Emergency All-Red
                    self.phase_state = "EMERGENCY_ALL_RED"
                    self.current_phase_duration = 1.5
                    self.current_phase_start = now
                    remaining = 2
                    logger.info("Signal Phase: EMERGENCY_ALL_RED (1.5s)")

            elif self.phase_state == "EMERGENCY_ALL_RED":
                if remaining <= 0:
                    # Activate the Emergency Green Corridor on target approach
                    self.active_direction = self.emergency_approach
                    self.phase_state = "EMERGENCY_GREEN_CORRIDOR"
                    self.current_phase_duration = 45  # 45s default green corridor
                    self.current_phase_start = now
                    remaining = 45
                    logger.info(f"🚨 GREEN CORRIDOR ACTIVE: Approach {self.active_direction} is now GREEN!")

            elif self.phase_state == "EMERGENCY_GREEN_CORRIDOR":
                if remaining <= 0:
                    # Timeout elapsed: clear emergency automatically
                    logger.info("Emergency corridor timeout reached (45s). Clearing pre-emption.")
                    self.clear_emergency_preemption()

            return self.get_current_signal_states(remaining_seconds=remaining)

        # ----------------------------------------------------
        # STANDARD ROUND-ROBIN ADAPTIVE PHASES
        # ----------------------------------------------------
        if remaining <= 0:
            if self.phase_state == "GREEN_ACTIVE":
                self.phase_state = "YELLOW_CLEARANCE"
                self.current_phase_duration = self.yellow_time
                self.current_phase_start = now
                remaining = self.yellow_time
                logger.info(f"Signal Phase: {self.active_direction} -> YELLOW_CLEARANCE ({self.yellow_time}s)")

            elif self.phase_state == "YELLOW_CLEARANCE":
                self.phase_state = "ALL_RED_CLEARANCE"
                self.current_phase_duration = self.all_red_time
                self.current_phase_start = now
                remaining = self.all_red_time
                logger.info(f"Signal Phase: ALL_RED_CLEARANCE ({self.all_red_time}s)")

            elif self.phase_state == "ALL_RED_CLEARANCE":
                if approach_telemetry:
                    self.calculate_webster_allocations(approach_telemetry)

                # If an approach was interrupted by emergency preemption, service it first
                if self.interrupted_direction:
                    self.active_direction = self.interrupted_direction
                    green_time = self.interrupted_remaining or self.allocated_green.get(self.active_direction, self.min_green)
                    self.interrupted_direction = None
                    self.interrupted_remaining = 0
                else:
                    current_idx = self.directions.index(self.active_direction)
                    next_idx = (current_idx + 1) % len(self.directions)
                    self.active_direction = self.directions[next_idx]
                    if next_idx == 0:
                        self.cycle_count += 1
                    green_time = self.allocated_green.get(self.active_direction, self.min_green)

                self.phase_state = "GREEN_ACTIVE"
                self.current_phase_duration = green_time
                self.current_phase_start = now
                remaining = self.current_phase_duration
                logger.info(f"Signal Phase: Switched to {self.active_direction} GREEN_ACTIVE ({green_time}s)")

        return self.get_current_signal_states(remaining_seconds=remaining)

    def get_current_signal_states(self, remaining_seconds: Optional[int] = None) -> Dict[str, Any]:
        """
        Returns snapshot of current signal states across all 4 approaches.
        Safety Invariant: Only 1 approach can be GREEN simultaneously.
        """
        if remaining_seconds is None:
            elapsed = time.time() - self.current_phase_start
            remaining_seconds = max(0, int(round(self.current_phase_duration - elapsed)))

        signal_states = {}
        for d in self.directions:
            if self.phase_state in ["ALL_RED_CLEARANCE", "EMERGENCY_ALL_RED"]:
                signal_states[d] = "RED"
            elif d == self.active_direction:
                if self.phase_state in ["GREEN_ACTIVE", "EMERGENCY_GREEN_CORRIDOR"]:
                    signal_states[d] = "GREEN"
                elif self.phase_state in ["YELLOW_CLEARANCE", "EMERGENCY_YELLOW_CLEARANCE"]:
                    signal_states[d] = "YELLOW"
                else:
                    signal_states[d] = "RED"
            else:
                signal_states[d] = "RED"

        return {
            "activeDirection": self.active_direction,
            "phaseState": self.phase_state,
            "remainingSeconds": remaining_seconds,
            "allocatedGreenSeconds": self.allocated_green.get(self.active_direction, self.min_green),
            "signalStates": signal_states,
            "cycleCount": self.cycle_count,
            "emergencyOverride": {
                "isActive": self.emergency_active,
                "approach": self.emergency_approach,
                "vehicleType": self.emergency_vehicle_type
            }
        }
