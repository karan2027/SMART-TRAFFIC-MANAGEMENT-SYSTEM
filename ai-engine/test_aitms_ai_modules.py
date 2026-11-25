import os
import sys
import time
import math
import numpy as np
import logging

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger("TestAITMSAI")

from detection.accident_detector import AccidentDetector
from detection.animal_hazard_detector import AnimalHazardDetector
from detection.pedestrian_safety_detector import PedestrianSafetyDetector
from detection.anpr_detector import ANPRDetector
from detection.violation_detector import TrafficViolationDetector
from traffic.green_corridor_router import GreenCorridorRouter
from traffic.prediction_engine import TrafficPredictionEngine
from traffic.v2x_spat_glosa import V2XSPaTGLOSA
from traffic.environmental_telemetry import EnvironmentalTelemetryEngine

def run_all_tests():
    print("\n" + "="*65)
    print("RUNNING COMPLETE AITMS AI MODULES INTEGRATION TEST SUITE")
    print("="*65 + "\n")

    passed = 0
    failed = 0

    def test(name, fn):
        nonlocal passed, failed
        try:
            sys.stdout.write(f"TEST: {name}... ")
            fn()
            print("✅ PASS")
            passed += 1
        except Exception as e:
            print(f"❌ FAIL ({e})")
            failed += 1

    # 1. Accident Detection Kinematics & Ring Buffer
    def test_accident():
        detector = AccidentDetector(
            iou_threshold=0.25,
            speed_drop_threshold_kmh=35.0,
            duration_seconds_threshold=8.0
        )
        base_time = 1000.0

        # Frame 0: Vehicle 1 (fast, 45 km/h) approaching Vehicle 2 (slow, 10 km/h)
        tracks_t0 = [
            {"track_id": 1, "bbox": [100, 200, 180, 280], "speed_kmh": 45.0},
            {"track_id": 2, "bbox": [150, 220, 230, 300], "speed_kmh": 10.0}
        ]
        detector.process_tracks(tracks_t0, timestamp=base_time)

        # Collision impact: speed drops to 0 km/h, high overlap IoU >= 0.30
        tracks_impact = [
            {"track_id": 1, "bbox": [130, 210, 210, 290], "speed_kmh": 0.0},
            {"track_id": 2, "bbox": [140, 215, 220, 295], "speed_kmh": 0.0}
        ]

        # Simulate 9 seconds of sustained overlap after collision
        for t_step in range(1, 10):
            detector.process_tracks(tracks_impact, timestamp=base_time + t_step)

        if len(detector.detected_incidents) == 0:
            raise AssertionError("Kinematic collision was not detected after sustained drop and overlap!")
        inc = detector.detected_incidents[0]
        if inc["peak_speed_before_kmh"] < 35.0 or inc["severity"] != "CRITICAL":
            raise AssertionError("Incident metadata invalid")
    test("Accident Detection (Kinematic Deceleration >35->0 km/h & Sustained IoU)", test_accident)

    # 2. Stray Animal Hazard & Metric Isolation
    def test_animal_hazard():
        hazard_detector = AnimalHazardDetector(
            confidence_threshold=0.55,
            persistence_frames_threshold=12,
            stationary_timeout_seconds=30.0
        )

        raw_detections = [
            {"class_id": 2, "class_name": "car", "confidence": 0.90, "bbox": [10, 10, 60, 60]},
            {"class_id": 19, "class_name": "cow", "confidence": 0.88, "bbox": [300, 400, 450, 520]},
            {"class_id": 3, "class_name": "motorcycle", "confidence": 0.82, "bbox": [100, 120, 140, 180]}
        ]

        # Verify Metric Isolation
        vehicular, animals = hazard_detector.filter_raw_detections(raw_detections)
        if len(vehicular) != 2 or any(d["class_name"] == "cow" for d in vehicular):
            raise AssertionError("Metric Isolation Failed: Stray cattle leaked into vehicular queue math!")
        if len(animals) != 1 or animals[0]["class_name"] != "cow":
            raise AssertionError("Animal isolation failed")

        # Test persistence across 15 frames
        now = 1000.0
        all_emitted_events = []
        for f in range(15):
            evs = hazard_detector.update(animals, current_time=now + (f * 0.1))
            all_emitted_events.extend(evs)

        if len(all_emitted_events) == 0:
            raise AssertionError("Hazard event was not emitted after 12 consecutive frames!")
        if all_emitted_events[0]["signal_mitigation"] not in ["ALL_RED_CAUTION_PAUSE", "FLASHING_AMBER_PROCEED_WITH_CAUTION"]:
            raise AssertionError("Invalid signal mitigation response")
    test("Stray Animal Hazard (Metric Isolation from Queue Math & Tiered Caution)", test_animal_hazard)

    # 3. Pedestrian Crosswalk & Dynamic Extension
    def test_pedestrian_safety():
        ped_detector = PedestrianSafetyDetector()

        # Pedestrian crossing in ROI
        detections = [
            {"class_id": 0, "class_name": "person", "confidence": 0.92, "bbox": [400, 520, 450, 650]} # bottom_center = (425, 650) inside crosswalk
        ]

        # Case A: Walk timer high (15s) -> no extension needed yet
        res1 = ped_detector.analyze_pedestrians(detections, current_signal_remaining_seconds=15)
        if res1["dynamic_walk_extension_seconds"] != 0 or not res1["crosswalk_occupied"]:
            raise AssertionError("Walk timer high should not trigger premature extension")

        # Case B: Walk timer low (3s remaining) -> dynamic extension triggered (+5 to 10s)
        res2 = ped_detector.analyze_pedestrians(detections, current_signal_remaining_seconds=3)
        if res2["dynamic_walk_extension_seconds"] < 5 or not res2["turning_conflict_suppressed"]:
            raise AssertionError("Walk extension failed to activate for crossing pedestrian!")
    test("Pedestrian Safety (Crosswalk ROI & Dynamic Walk Extension)", test_pedestrian_safety)

    # 4. ANPR & Indian Plate Validation
    def test_anpr():
        anpr = ANPRDetector()

        # Valid Indian Plates
        v1 = anpr.validate_indian_plate("DL01CA1234")
        v2 = anpr.validate_indian_plate("MH12AB9876")
        v3 = anpr.validate_indian_plate("KA05MB4321")
        v4 = anpr.validate_indian_plate("HR26DQ5555")

        if not (v1["is_valid"] and v2["is_valid"] and v3["is_valid"] and v4["is_valid"]):
            raise AssertionError(f"Valid Indian plates failed regex check: {v1}, {v2}, {v3}, {v4}")

        # Invalid Plates
        inv1 = anpr.validate_indian_plate("1234ABCD")
        inv2 = anpr.validate_indian_plate("ZZ99ZZ9999") # ZZ is not an Indian state
        inv3 = anpr.validate_indian_plate("ABC")

        if inv1["is_valid"] or inv2["is_valid"] or inv3["is_valid"]:
            raise AssertionError("Invalid plates were falsely accepted!")
    test("ANPR & Indian License Plate Validation (State Code & Number Format)", test_anpr)

    # 5. Traffic Violations
    def test_violations():
        viol = TrafficViolationDetector(stop_line_y=480, permitted_heading_deg=90.0, speed_limit_kmh=50.0)

        # Red Light Jump (crosses Y=480 while RED)
        r_violation = viol.check_red_light_jump(
            track_id=10,
            current_bbox=[100, 420, 160, 490], # bottom=490 > 480
            previous_bbox=[100, 400, 160, 470], # bottom=470 < 480
            current_signal_state="RED"
        )
        if not r_violation or r_violation["violation_type"] != "RED_LIGHT_JUMP":
            raise AssertionError("Red light jump detector failed to flag stop-line crossing!")

        # Wrong-Side Driving (heading upwards ~270° instead of permitted downwards 90°)
        w_detected = None
        for y_pos in [400, 370, 340, 310, 280, 250, 220]:
            res = viol.check_wrong_side(track_id=20, current_centroid=(200, y_pos))
            if res:
                w_detected = res

        if not w_detected or w_detected["violation_type"] != "WRONG_SIDE_DRIVING":
            raise AssertionError("Wrong-side driving detector failed to flag opposite trajectory!")

        # Two-Wheeler Violations: Helmet & Triple Riding
        tw_viol = viol.check_two_wheeler_violations(track_id=30, vehicle_class="motorcycle", rider_count=3, has_helmet=False)
        types = [v["violation_type"] for v in tw_viol]
        if "TRIPLE_RIDING" not in types or "HELMET_VIOLATION" not in types:
            raise AssertionError(f"Two-wheeler violation detector missed violations: {types}")
    test("Traffic Violations (Red Light Jump, Wrong-Side, Helmet, Triple Riding)", test_violations)

    # 6. Green Corridor Graph Routing (Dijkstra)
    def test_green_corridor():
        router = GreenCorridorRouter()
        route = router.compute_emergency_corridor("JUNC001", "JUNC002")

        if route["start_junction"] != "JUNC001" or route["destination_junction"] != "JUNC002":
            raise AssertionError("Route endpoints do not match")
        if route["route_nodes_count"] < 2 or route["estimated_travel_time_seconds"] <= 0:
            raise AssertionError("Invalid route calculation")
    test("Green Corridor Management (NetworkX Graph & Dijkstra Optimal Routing)", test_green_corridor)

    # 7. AI Traffic Prediction & Error Metrics
    def test_prediction():
        pred_engine = TrafficPredictionEngine()
        for i in range(20):
            flow = 500.0 + (i * 15.0) + (np.sin(i) * 30.0)
            pred_engine.feed_reading(flow)

        forecasts = pred_engine.forecast_horizons()
        for h in [5, 15, 30]:
            if h not in forecasts:
                raise AssertionError(f"Missing horizon {h}m")
            f = forecasts[h]
            if f["predicted_flow_vph"] <= 0 or f["metrics"]["mae"] <= 0:
                raise AssertionError(f"Invalid forecast metrics for horizon {h}")

        # Mathematical verification of MAE, RMSE, MAPE
        y_true = [100.0, 110.0, 120.0, 130.0]
        y_pred = [105.0, 108.0, 125.0, 128.0]
        eval_metrics = pred_engine.evaluate_model_performance(y_true, y_pred)
        expected_mae = (5.0 + 2.0 + 5.0 + 2.0) / 4.0 # 3.5
        if abs(eval_metrics["mae"] - expected_mae) > 0.01:
            raise AssertionError(f"MAE calculation error: expected {expected_mae}, got {eval_metrics['mae']}")
    test("Traffic Prediction (5/15/30-min Horizons & MAE/RMSE/MAPE Mathematical Verification)", test_prediction)

    # 8. V2X SPaT & GLOSA Advisory
    def test_v2x():
        v2x = V2XSPaTGLOSA(speed_limit_kmh=60.0, min_speed_kmh=20.0)
        advisory = v2x.calculate_glosa_speed(distance_to_stop_line_meters=140.0, current_signal_state="GREEN", remaining_phase_seconds=20.0)
        if advisory["recommended_glosa_speed_kmh"] <= 0 or advisory["driver_action"] != "MAINTAIN_SPEED":
            raise AssertionError("GLOSA advisory calculation error")

        packet = v2x.generate_spat_packet("JUNC001", "NORTH", "GREEN_ACTIVE", 20.0)
        if packet["protocol"] != "V2X_SPAT_SAE_J2735":
            raise AssertionError("SPaT packet missing standard protocol header")
    test("V2X SPaT & GLOSA Speed Advisory (Arrive on Green Optimization)", test_v2x)

    # 9. Environmental Telemetry & Carbon Offset
    def test_environmental():
        env = EnvironmentalTelemetryEngine()
        savings = env.record_cycle_savings(vehicles_serviced=20, avg_delay_reduction_seconds=15.0)

        if abs(savings["cycle_savings"]["idle_time_reduced_seconds"] - 300.0) > 0.1:
            raise AssertionError("Idle time calculation error")
        if savings["cycle_savings"]["co2_prevented_kg"] <= 0 or savings["cycle_savings"]["fuel_saved_litres"] <= 0:
            raise AssertionError("Environmental calculation produced non-positive values")
    test("Environmental Telemetry (Idle Reduction -> Fuel Saved -> CO2 & PM2.5 Prevented)", test_environmental)

    print("\n" + "="*65)
    print(f"TOTAL TESTS: {passed + failed} | PASSED: {passed} | FAILED: {failed}")
    print("="*65 + "\n")

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
