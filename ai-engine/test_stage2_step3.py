import os
import sys
import time
import numpy as np
import cv2
import logging

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger("TestStage2Step3")

from detection.emergency_detector import EmergencyVehicleDetector
from traffic.adaptive_controller import AdaptiveSignalController

def test_emergency_detector_signatures():
    print("\n" + "="*55)
    print("TEST 1: MULTI-SPECTRAL EMERGENCY VEHICLE CLASSIFICATION")
    print("="*55)

    detector = EmergencyVehicleDetector(confidence_threshold=0.70)

    # 1. Generate Synthetic Fire Truck Crop (High-Intensity Red Body + Rooftop Beacon)
    fire_crop = np.zeros((120, 80, 3), dtype=np.uint8)
    fire_crop[:, :] = (20, 20, 210) # Strong BGR Red
    # Rooftop beacon bar in upper 20%
    fire_crop[:24, 25:55] = (255, 100, 100) # Bright strobe
    fire_res = detector.analyze_crop(fire_crop)

    print(f"Fire Engine Crop Test   -> Detected: {fire_res['is_emergency']} | Type: {fire_res['vehicle_type']} | Conf: {fire_res['confidence']}")
    assert fire_res['is_emergency'] is True, "Fire engine crop should be detected as emergency!"
    assert fire_res['vehicle_type'] == "FIRE_TRUCK", "Expected FIRE_TRUCK vehicle type"
    assert fire_res['confidence'] >= 0.70

    # 2. Generate Synthetic Ambulance Crop (White Medical Body + Red Stripe/Cross + Blue Beacon)
    amb_crop = np.ones((120, 80, 3), dtype=np.uint8) * 230 # White base body
    # Red cross / stripe pattern
    amb_crop[45:75, 30:50] = (20, 20, 220)
    amb_crop[55:65, 15:65] = (20, 20, 220)
    # Rooftop blue/red beacon
    amb_crop[:24, 20:40] = (220, 30, 20) # Blue beacon
    amb_crop[:24, 40:60] = (20, 20, 220) # Red beacon
    amb_res = detector.analyze_crop(amb_crop)

    print(f"Ambulance Crop Test     -> Detected: {amb_res['is_emergency']} | Type: {amb_res['vehicle_type']} | Conf: {amb_res['confidence']}")
    assert amb_res['is_emergency'] is True, "Ambulance crop should be detected as emergency!"
    assert amb_res['vehicle_type'] == "AMBULANCE", "Expected AMBULANCE vehicle type"

    # 3. Generate Normal Civilian Car Crop (Dark Gray Sedan, no beacons)
    car_crop = np.ones((120, 80, 3), dtype=np.uint8) * 60 # Dark gray
    car_res = detector.analyze_crop(car_crop)

    print(f"Civilian Car Crop Test  -> Detected: {car_res['is_emergency']} | Type: {car_res['vehicle_type']} | Conf: {car_res['confidence']}")
    assert car_res['is_emergency'] is False, "Standard civilian car must NOT trigger emergency pre-emption!"
    print("✅ TEST 1 PASSED: Multi-spectral emergency vehicle detector verified!\n")

def test_emergency_preemption_lifecycle():
    print("="*55)
    print("TEST 2: ADVANCED EMERGENCY CLEARANCE & GREEN CORRIDOR FSM")
    print("="*55)

    controller = AdaptiveSignalController(
        min_green=20,
        max_green=60,
        yellow_time=4,
        all_red_time=2,
        target_cycle=100
    )

    # Initial state: NORTH is currently GREEN_ACTIVE
    controller.active_direction = "NORTH"
    controller.phase_state = "GREEN_ACTIVE"
    controller.current_phase_start = time.time()
    controller.current_phase_duration = 30

    print("Initial State: NORTH approach is GREEN_ACTIVE (normal traffic)")
    s0 = controller.get_current_signal_states()
    assert s0['signalStates']['NORTH'] == "GREEN"

    # Emergency called on SOUTH approach for AMBULANCE
    print("Action: Ambulance detected on SOUTH approach -> Triggering Pre-emption")
    p1 = controller.trigger_emergency_preemption(approach="SOUTH", vehicle_type="AMBULANCE")

    # Invariant: NORTH must safely enter EMERGENCY_YELLOW_CLEARANCE (not instantly red to avoid collision)
    print(f"Phase 1 Transition -> State: {p1['phaseState']} | Active Direction: {p1['activeDirection']}")
    print(f"Signals during clearance: {p1['signalStates']}")
    assert p1['phaseState'] == "EMERGENCY_YELLOW_CLEARANCE"
    assert p1['signalStates']['NORTH'] == "YELLOW", "Interrupted approach must display YELLOW during clearance!"

    # Simulate expiration of Emergency Yellow
    controller.current_phase_start = time.time() - 4.0
    p2 = controller.tick()
    print(f"Phase 2 Transition -> State: {p2['phaseState']} | Signals: {p2['signalStates']}")
    assert p2['phaseState'] == "EMERGENCY_ALL_RED"
    assert all(sig == "RED" for sig in p2['signalStates'].values()), "All approaches must be RED during all-red clearance!"

    # Simulate expiration of Emergency All-Red -> SOUTH GREEN CORRIDOR ACTIVATED
    controller.current_phase_start = time.time() - 2.0
    p3 = controller.tick()
    print(f"Phase 3 Corridor   -> State: {p3['phaseState']} | Active Direction: {p3['activeDirection']}")
    print(f"Signals: {p3['signalStates']}")
    assert p3['phaseState'] == "EMERGENCY_GREEN_CORRIDOR"
    assert p3['activeDirection'] == "SOUTH"
    assert p3['signalStates']['SOUTH'] == "GREEN", "SOUTH corridor must be forced GREEN!"
    assert p3['signalStates']['NORTH'] == "RED", "Conflicting NORTH must be RED"
    assert p3['signalStates']['EAST'] == "RED", "Conflicting EAST must be RED"
    assert p3['signalStates']['WEST'] == "RED", "Conflicting WEST must be RED"

    # Clear Emergency Pre-emption -> Revert cleanly to normal cycle
    print("Action: Ambulance crossed intersection -> Clearing Emergency Pre-emption")
    p4 = controller.clear_emergency_preemption()
    print(f"Phase 4 Recovery   -> State: {p4['phaseState']} | Emergency Active: {p4['emergencyOverride']['isActive']}")
    assert p4['phaseState'] == "ALL_RED_CLEARANCE"
    assert p4['emergencyOverride']['isActive'] is False

    # After All-Red -> Interrupted NORTH approach receives remaining service time fairly
    controller.current_phase_start = time.time() - 3.0
    p5 = controller.tick()
    print(f"Phase 5 Fair Resume-> Resumed Direction: {p5['activeDirection']} ({p5['phaseState']})")
    assert p5['activeDirection'] == "NORTH", "Interrupted approach should be resumed fairly!"
    assert p5['signalStates']['NORTH'] == "GREEN"

    print("✅ TEST 2 PASSED: Complete Emergency clearance lifecycle verified!\n")

def test_multistream_emergency_integration():
    print("="*55)
    print("TEST 3: MULTI-STREAM AUTO-DETECTION & PRE-EMPTION TRIGGER")
    print("="*55)

    from video.multi_stream_manager import MultiStreamManager

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    streams = {
        "NORTH": os.path.join(base_dir, "data", "videos", "traffic_road_01.mp4"),
        "SOUTH": os.path.join(base_dir, "data", "videos", "v3.mp4"),
        "EAST":  os.path.join(base_dir, "data", "videos", "tv2.mp4"),
        "WEST":  os.path.join(base_dir, "data", "videos", "v4.mp4")
    }

    manager = MultiStreamManager(
        stream_sources=streams,
        junction_id="JUNC001",
        config_path="config/config.yaml",
        sync_with_backend=False
    )
    manager.start()

    print("MultiStreamManager started. Injecting simulated AMBULANCE on EAST approach...")
    manager.set_simulated_emergency(approach="EAST", vehicle_type="AMBULANCE", duration_seconds=15.0)

    time.sleep(3.0)
    snapshot = manager.get_telemetry_snapshot()

    em_status = snapshot.get("emergencyStatus", {})
    signals = snapshot.get("signalControl", {})
    print(f"Emergency Active  : {em_status.get('isActive')}")
    print(f"Emergency Approach: {em_status.get('approach')}")
    print(f"Vehicle Type      : {em_status.get('vehicleType')}")
    print(f"Current Phase     : {signals.get('phaseState')}")

    assert em_status.get('isActive') is True, "Emergency status should be ACTIVE!"
    assert em_status.get('approach') == "EAST", "Emergency approach should be EAST!"

    print("Clearing simulated emergency...")
    manager.clear_emergency()
    time.sleep(1.0)
    post_snapshot = manager.get_telemetry_snapshot()
    manager.stop()

    assert post_snapshot["emergencyStatus"]["isActive"] is False, "Emergency status should be CLEARED!"
    print("✅ TEST 3 PASSED: MultiStreamManager emergency detection & recovery verified!\n")

if __name__ == "__main__":
    test_emergency_detector_signatures()
    test_emergency_preemption_lifecycle()
    test_multistream_emergency_integration()
    print("==================================================")
    print("ALL STAGE 2 — STEP 3 EMERGENCY TESTS PASSED! 🎉")
    print("==================================================\n")
