import os
import cv2
import time
import queue
import logging
import threading
import requests
import numpy as np
from typing import Dict, Any, Optional

from detection.detector import VehicleDetector
from detection.emergency_detector import EmergencyVehicleDetector
from tracking.tracker import VehicleTracker
from counting.counter import VehicleCounter
from speed.estimator import SpeedEstimator
from traffic.analyzer import TrafficAnalyzer
from traffic.adaptive_controller import AdaptiveSignalController

logger = logging.getLogger("MultiStreamManager")

class StreamWorker(threading.Thread):
    """
    Dedicated thread for ingesting a single video or RTSP stream.
    Keeps buffer size <= 2 by discarding outdated frames to guarantee real-time latency.
    """
    def __init__(self, direction: str, source_url: str, loop: bool = True):
        super().__init__(daemon=True)
        self.direction = direction
        self.source_url = source_url
        self.loop = loop
        self.running = False
        self.frame_queue = queue.Queue(maxsize=2)
        self.fps = 30.0
        self.width = 1280
        self.height = 720
        self.is_connected = False

    def run(self):
        self.running = True
        logger.info(f"[{self.direction}] Connecting to stream: {self.source_url}")

        while self.running:
            cap = cv2.VideoCapture(self.source_url)
            if not cap.isOpened():
                logger.error(f"[{self.direction}] Unable to open stream: {self.source_url}. Retrying in 2s...")
                self.is_connected = False
                time.sleep(2.0)
                continue

            self.is_connected = True
            self.fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            self.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
            self.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
            logger.info(f"[{self.direction}] Connected successfully ({self.width}x{self.height} @ {self.fps:.1f} FPS)")

            frame_delay = 1.0 / max(10.0, min(60.0, self.fps))

            while self.running:
                ret, frame = cap.read()
                if not ret:
                    if self.loop:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    else:
                        break

                # Discard oldest frame if queue full to maintain real-time sync
                if self.frame_queue.full():
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass

                self.frame_queue.put(frame)
                time.sleep(frame_delay * 0.5)

            cap.release()
            self.is_connected = False
            if not self.loop:
                break

    def get_latest_frame(self) -> Optional[np.ndarray]:
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None

    def stop(self):
        self.running = False


class MultiStreamManager:
    """
    Stage 2 Multi-Stream Ingestion & Adaptive Control Orchestrator.
    Processes 4 approaches (North, South, East, West) concurrently,
    detects Emergency Vehicles (Ambulances, Fire Trucks, Police),
    calculates queue lengths, applies Webster's Dynamic Green allocations,
    and coordinates live signal transitions.
    """

    def __init__(
        self,
        stream_sources: Dict[str, str],
        junction_id: str = "JUNC001",
        config_path: str = "config/config.yaml",
        backend_api_url: str = "http://localhost:5000",
        sync_with_backend: bool = True
    ):
        self.directions = ["NORTH", "SOUTH", "EAST", "WEST"]
        self.junction_id = junction_id
        self.stream_sources = stream_sources
        self.backend_api_url = backend_api_url.rstrip("/")
        self.sync_with_backend = sync_with_backend

        # Shared detector and tracking components
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cfg_file = os.path.join(base_dir, config_path) if not os.path.isabs(config_path) else config_path
        
        import yaml
        with open(cfg_file, 'r') as f:
            self.cfg = yaml.safe_load(f)

        logger.info("Initializing shared YOLOv8 detection model...")
        self.detector = VehicleDetector(
            model_name=self.cfg['detection']['model_name'],
            conf_thresh=self.cfg['detection']['confidence_threshold'],
            iou_thresh=self.cfg['detection']['iou_threshold'],
            target_classes=self.cfg['detection']['target_classes']
        )

        # Emergency vehicle detector (Ambulances, Fire Trucks, Police)
        self.emergency_detector = EmergencyVehicleDetector(confidence_threshold=0.70)

        width, height = 1280, 720
        line_cfg = self.cfg['counting_line']['line_normalized']
        line_start = (int(line_cfg['start'][0] * width), int(line_cfg['start'][1] * height))
        line_end = (int(line_cfg['end'][0] * width), int(line_cfg['end'][1] * height))

        calib_pts_norm = self.cfg['speed']['calibration_points_normalized']
        calib_pts = [(int(p[0] * width), int(p[1] * height)) for p in calib_pts_norm]

        # Initialize per-approach perception modules
        self.workers: Dict[str, StreamWorker] = {}
        self.trackers: Dict[str, VehicleTracker] = {}
        self.counters: Dict[str, VehicleCounter] = {}
        self.speed_estimators: Dict[str, SpeedEstimator] = {}
        self.analyzers: Dict[str, TrafficAnalyzer] = {}

        for d in self.directions:
            url = stream_sources.get(d, "data/videos/traffic_road_01.mp4")
            if not os.path.isabs(url) and not url.startswith("rtsp://") and not url.startswith("http"):
                url = os.path.join(os.path.dirname(base_dir), url)
            
            self.workers[d] = StreamWorker(direction=d, source_url=url, loop=True)
            self.trackers[d] = VehicleTracker(
                model=self.detector.model,
                tracker_config=self.cfg['tracking']['tracker_type'],
                conf_thresh=self.cfg['detection']['confidence_threshold'],
                iou_thresh=self.cfg['detection']['iou_threshold'],
                target_classes=self.cfg['detection']['target_classes']
            )
            self.counters[d] = VehicleCounter(
                line_coords=(line_start, line_end),
                direction_a_name=self.cfg['counting_line'].get('direction_a_label', 'Inbound'),
                direction_b_name=self.cfg['counting_line'].get('direction_b_label', 'Outbound')
            )
            self.speed_estimators[d] = SpeedEstimator(
                is_calibrated=self.cfg['speed']['is_calibrated'],
                reference_distance_meters=self.cfg['speed']['reference_distance_meters'],
                calibration_points=calib_pts,
                fps=30.0
            )
            self.analyzers[d] = TrafficAnalyzer(
                density_thresholds=self.cfg.get('density_thresholds'),
                congestion_thresholds=self.cfg.get('congestion_thresholds')
            )

        # Adaptive Signal Controller with Webster formula
        self.controller = AdaptiveSignalController(
            min_green=15,
            max_green=75,
            yellow_time=4,
            all_red_time=2,
            target_cycle=120
        )

        # Telemetry Store
        self.approach_telemetry: Dict[str, Dict[str, Any]] = {
            d: {
                "activeVehicles": 0,
                "queueCount": 0,
                "averageSpeedKmh": 30.0,
                "flowRateVph": 0.0,
                "densityLevel": "LOW",
                "congestionLevel": "LOW",
                "hasEmergencyVehicle": False,
                "emergencyType": "NONE",
                "classCounts": {"cars": 0, "motorcycles": 0, "buses": 0, "trucks": 0}
            }
            for d in self.directions
        }

        self.running = False
        self.processing_thread: Optional[threading.Thread] = None
        self.last_sync_time = 0.0

    def start(self):
        """Starts all 4 video stream worker threads and processing loop."""
        self.running = True
        for d, worker in self.workers.items():
            worker.start()

        self.processing_thread = threading.Thread(target=self._processing_loop, daemon=True)
        self.processing_thread.start()
        logger.info(f"MultiStreamManager started for 4-way intersection {self.junction_id}")

    def _processing_loop(self):
        """
        Main orchestration loop:
        1. Reads latest frame from all 4 streams.
        2. Executes detection, tracking, queue calculation, and emergency check.
        3. Updates Webster green time allocation and advances signal controller.
        4. Syncs with backend REST API.
        """
        frame_index = 0
        while self.running:
            loop_start = time.time()
            frame_index += 1

            for d in self.directions:
                frame = self.workers[d].get_latest_frame()
                if frame is None:
                    continue

                # Run YOLO tracking every 2nd frame for processing efficiency
                if frame_index % 2 == 0:
                    tracks = self.trackers[d].track_frame(frame)
                    
                    active_count = len(tracks)
                    queue_count = 0
                    speeds = []
                    class_breakdown = {"cars": 0, "motorcycles": 0, "buses": 0, "trucks": 0}
                    has_emergency = False
                    emergency_type = "NONE"

                    for trk in tracks:
                        cls_name = trk.get('class_name', '').lower()
                        if 'car' in cls_name:
                            class_breakdown['cars'] += 1
                        elif 'motorcycle' in cls_name or 'bike' in cls_name:
                            class_breakdown['motorcycles'] += 1
                        elif 'bus' in cls_name:
                            class_breakdown['buses'] += 1
                        elif 'truck' in cls_name:
                            class_breakdown['trucks'] += 1

                        # Speed and Queue Estimation using correct signature
                        spd_info = self.speed_estimators[d].estimate_speed(
                            track_id=trk['track_id'],
                            current_frame_idx=frame_index,
                            current_centroid=trk['centroid']
                        )
                        spd = spd_info.get('speed_kmh', 0.0)
                        if spd > 0:
                            speeds.append(spd)

                        # A vehicle is counted in queue if stationary or speed < 5 km/h
                        if spd_info.get('is_stationary', False) or spd < 5.0:
                            queue_count += 1

                    # Emergency Vehicle Detection (Simulated or Multi-Spectral Vision)
                    sim_type = self.emergency_detector.is_simulated_active(d)
                    if sim_type:
                        has_emergency = True
                        emergency_type = sim_type
                    else:
                        em_result = self.emergency_detector.detect_in_frame(frame, tracks, approach=d)
                        if em_result.get("detected"):
                            has_emergency = True
                            emergency_type = em_result.get("vehicle_type", "AMBULANCE")

                    avg_speed = float(np.mean(speeds)) if speeds else 25.0
                    density = self.analyzers[d].determine_density_level(active_count)
                    congestion = self.analyzers[d].determine_congestion_level(avg_speed, density)
                    flow_vph = self.analyzers[d].calculate_flow_rate(active_count, 10)

                    self.approach_telemetry[d] = {
                        "activeVehicles": active_count,
                        "queueCount": queue_count,
                        "averageSpeedKmh": round(avg_speed, 1),
                        "flowRateVph": flow_vph,
                        "densityLevel": density,
                        "congestionLevel": congestion,
                        "hasEmergencyVehicle": has_emergency,
                        "emergencyType": emergency_type,
                        "classCounts": class_breakdown
                    }

                    # Auto-trigger emergency preemption if emergency vehicle detected
                    if has_emergency and not self.controller.emergency_active:
                        logger.warning(
                            f"🚨 EMERGENCY DETECTED on {d} approach ({emergency_type})! "
                            f"Triggering Priority Green Corridor Pre-emption."
                        )
                        self.controller.trigger_emergency_preemption(approach=d, vehicle_type=emergency_type)
                        self._sync_emergency_with_backend(d, emergency_type)

            # Advance controller state machine by 1 tick
            signal_state = self.controller.tick(self.approach_telemetry)

            # Sync signal phase to Express backend every 1.5 seconds or on phase change
            if self.sync_with_backend and (time.time() - self.last_sync_time >= 1.5):
                self._sync_phase_with_backend(signal_state)
                self.last_sync_time = time.time()

            # Maintain ~10 Hz evaluation cycle
            elapsed = time.time() - loop_start
            sleep_time = max(0.01, 0.1 - elapsed)
            time.sleep(sleep_time)

    def _sync_phase_with_backend(self, signal_state: Dict[str, Any]):
        """Pushes real-time phase updates to backend REST API."""
        try:
            url = f"{self.backend_api_url}/api/junctions/{self.junction_id}/phase"
            payload = {
                "activeDirection": signal_state["activeDirection"],
                "phaseState": signal_state["phaseState"],
                "allocatedGreenSeconds": signal_state["allocatedGreenSeconds"],
                "remainingSeconds": signal_state["remainingSeconds"],
                "signalStates": signal_state["signalStates"]
            }
            requests.put(url, json=payload, timeout=0.8)
        except Exception:
            pass

    def _sync_emergency_with_backend(self, approach: str, vehicle_type: str):
        """Pushes emergency preemption to backend REST API."""
        try:
            url = f"{self.backend_api_url}/api/junctions/{self.junction_id}/emergency"
            payload = {
                "approach": approach,
                "vehicleType": vehicle_type,
                "triggeredBy": "AI_DETECTION"
            }
            requests.post(url, json=payload, timeout=1.0)
        except Exception:
            pass

    def set_simulated_emergency(self, approach: str, vehicle_type: str = "AMBULANCE", duration_seconds: float = 30.0):
        """Injects a simulated emergency vehicle on approach for testing."""
        self.emergency_detector.set_simulated_emergency(approach, vehicle_type, duration_seconds)
        self.trigger_emergency(approach, vehicle_type)

    def clear_simulated_emergency(self, approach: Optional[str] = None):
        """Clears simulated emergency injection."""
        self.emergency_detector.clear_simulated_emergency(approach)
        self.clear_emergency()

    def get_telemetry_snapshot(self) -> Dict[str, Any]:
        """Returns instantaneous snapshot of the 4-way intersection."""
        signals = self.controller.get_current_signal_states()
        webster_data = self.controller.calculate_webster_allocations(self.approach_telemetry)
        return {
            "junctionId": self.junction_id,
            "timestamp": time.time(),
            "signalControl": signals,
            "websterCalculations": webster_data,
            "approaches": self.approach_telemetry,
            "emergencyStatus": {
                "isActive": self.controller.emergency_active,
                "approach": self.controller.emergency_approach,
                "vehicleType": self.controller.emergency_vehicle_type,
                "startedAt": self.controller.emergency_started_at
            }
        }

    def trigger_emergency(self, approach: str, vehicle_type: str = "AMBULANCE") -> Dict[str, Any]:
        res = self.controller.trigger_emergency_preemption(approach, vehicle_type)
        if self.sync_with_backend:
            self._sync_emergency_with_backend(approach, vehicle_type)
        return res

    def clear_emergency(self) -> Dict[str, Any]:
        res = self.controller.clear_emergency_preemption()
        if self.sync_with_backend:
            try:
                requests.post(f"{self.backend_api_url}/api/junctions/{self.junction_id}/emergency/clear", timeout=1.0)
            except Exception:
                pass
        return res

    def stop(self):
        """Stops all stream workers and loop."""
        self.running = False
        for worker in self.workers.values():
            worker.stop()
        logger.info(f"MultiStreamManager stopped for junction {self.junction_id}")
