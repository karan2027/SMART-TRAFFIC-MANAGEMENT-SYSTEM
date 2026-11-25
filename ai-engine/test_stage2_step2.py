import os
import sys
import time
import logging

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger("TestStage2Step2")

from traffic.adaptive_controller import AdaptiveSignalController

def test_webster_adaptive_controller():
    print("\n" + "="*55)
    print("TEST 1: WEBSTER'S OPTIMAL CYCLE & GREEN ALLOCATION")
    print("="*55)

    controller = AdaptiveSignalController(
        min_green=15,
        max_green=75,
        yellow_time=4,
        all_red_time=2,
        target_cycle=120
    )

    # Synthetic scenario:
    # NORTH has heavy queue (14 vehicles)
    # SOUTH has moderate queue (7 vehicles)
    # EAST has low queue (2 vehicles)
    # WEST has low queue (1 vehicle)
    telemetry = {
        "NORTH": {"queueCount": 14, "flowRateVph": 1200.0, "activeVehicles": 14},
        "SOUTH": {"queueCount": 7,  "flowRateVph": 650.0,  "activeVehicles": 7},
        "EAST":  {"queueCount": 2,  "flowRateVph": 250.0,  "activeVehicles": 2},
        "WEST":  {"queueCount": 1,  "flowRateVph": 150.0,  "activeVehicles": 1}
    }

    result = controller.calculate_webster_allocations(telemetry)
    print(f"Optimal Cycle Length : {result['optimalCycleSeconds']}s")
    print(f"Total Saturation Y   : {result['totalSaturationRatio']}")
    print(f"Allocated Green Times: {result['allocatedGreenSeconds']}")

    north_green = result['allocatedGreenSeconds']['NORTH']
    south_green = result['allocatedGreenSeconds']['SOUTH']
    east_green = result['allocatedGreenSeconds']['EAST']
    west_green = result['allocatedGreenSeconds']['WEST']

    # Invariants verification
    assert north_green > south_green, "Heavy queue approach (NORTH) must receive more green time than moderate (SOUTH)!"
    assert south_green > east_green, "SOUTH must receive more green time than EAST!"
    assert north_green <= controller.max_green, f"NORTH green must be <= {controller.max_green}"
    assert west_green >= controller.min_green, f"WEST green must be >= {controller.min_green}"
    print("✅ TEST 1 PASSED: Webster's allocations verified successfully!\n")

    print("="*55)
    print("TEST 2: STATE MACHINE TRANSITIONS (GREEN -> YELLOW -> ALL_RED -> NEXT)")
    print("="*55)

    # Force phase to end
    controller.current_phase_start = time.time() - (controller.current_phase_duration + 1)
    
    # Tick 1: Should transition from GREEN_ACTIVE -> YELLOW_CLEARANCE
    s1 = controller.tick(telemetry)
    print(f"After Green expiration -> State: {s1['phaseState']} | Signal: {s1['signalStates'][s1['activeDirection']]}")
    assert s1['phaseState'] == "YELLOW_CLEARANCE", "Expected YELLOW_CLEARANCE"
    assert s1['signalStates'][s1['activeDirection']] == "YELLOW", "Active direction must show YELLOW"

    # Force yellow to end
    controller.current_phase_start = time.time() - (controller.current_phase_duration + 1)
    s2 = controller.tick(telemetry)
    print(f"After Yellow expiration -> State: {s2['phaseState']} | Signals: {s2['signalStates']}")
    assert s2['phaseState'] == "ALL_RED_CLEARANCE", "Expected ALL_RED_CLEARANCE"
    assert all(sig == "RED" for sig in s2['signalStates'].values()), "All approaches must be RED during ALL_RED_CLEARANCE!"

    # Force all-red to end -> Next approach should turn GREEN
    controller.current_phase_start = time.time() - (controller.current_phase_duration + 1)
    s3 = controller.tick(telemetry)
    print(f"After All-Red -> Next Active: {s3['activeDirection']} | State: {s3['phaseState']} | Green: {s3['signalStates'][s3['activeDirection']]}")
    assert s3['phaseState'] == "GREEN_ACTIVE", "Expected GREEN_ACTIVE"
    assert s3['signalStates'][s3['activeDirection']] == "GREEN", "New approach must be GREEN"
    print("✅ TEST 2 PASSED: Phase transitions and safety clearance intervals verified!\n")

    print("="*55)
    print("TEST 3: EMERGENCY PRE-EMPTION OVERRIDE")
    print("="*55)
    em_res = controller.trigger_emergency_preemption(approach="SOUTH", vehicle_type="AMBULANCE")
    print(f"Emergency Active Approach: {em_res['activeDirection']}")
    print(f"Signals: {em_res['signalStates']}")
    assert em_res['signalStates']['SOUTH'] == "GREEN", "Emergency approach (SOUTH) must be forced GREEN"
    assert em_res['signalStates']['NORTH'] == "RED", "Conflicting NORTH must be RED"
    assert em_res['signalStates']['EAST'] == "RED", "Conflicting EAST must be RED"
    assert em_res['signalStates']['WEST'] == "RED", "Conflicting WEST must be RED"

    # Clear emergency
    clear_res = controller.clear_emergency_preemption()
    print(f"After Emergency Clear -> State: {clear_res['phaseState']} (Safety Clearance)")
    assert clear_res['emergencyOverride']['isActive'] is False
    print("✅ TEST 3 PASSED: Emergency green corridor pre-emption verified!\n")

def test_multi_stream_manager():
    print("="*55)
    print("TEST 4: MULTI-STREAM CONCURRENT 4-WAY INGESTION")
    print("="*55)

    from video.multi_stream_manager import MultiStreamManager

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    streams = {
        "NORTH": os.path.join(base_dir, "data", "videos", "traffic_road_01.mp4"),
        "SOUTH": os.path.join(base_dir, "data", "videos", "v3.mp4"),
        "EAST":  os.path.join(base_dir, "data", "videos", "tv2.mp4"),
        "WEST":  os.path.join(base_dir, "data", "videos", "v4.mp4")
    }

    # Verify video files exist
    for d, path in streams.items():
        if not os.path.exists(path):
            print(f"⚠️ Warning: Video {path} not found, using traffic_road_01.mp4")
            streams[d] = os.path.join(base_dir, "data", "videos", "traffic_road_01.mp4")

    manager = MultiStreamManager(
        stream_sources=streams,
        junction_id="JUNC001",
        config_path="config/config.yaml",
        sync_with_backend=False
    )

    manager.start()
    print("MultiStreamManager started. Ingesting 4 streams concurrently for 6 seconds...")
    time.sleep(6.0)

    snapshot = manager.get_telemetry_snapshot()
    manager.stop()

    print("\nTelemetry Snapshot Summary:")
    print(f"Junction ID : {snapshot['junctionId']}")
    print(f"Active Dir  : {snapshot['signalControl']['activeDirection']} ({snapshot['signalControl']['phaseState']})")
    print(f"Signals     : {snapshot['signalControl']['signalStates']}")
    print(f"Webster Allocations: {snapshot['websterCalculations']['allocatedGreenSeconds']}")
    for d, app in snapshot['approaches'].items():
        print(f"Approach {d:5s} -> Active: {app['activeVehicles']}, Queue: {app['queueCount']}, Avg Speed: {app['averageSpeedKmh']} km/h, Density: {app['densityLevel']}")

    assert "signalControl" in snapshot
    assert "websterCalculations" in snapshot
    assert len(snapshot["approaches"]) == 4
    print("\n✅ TEST 4 PASSED: 4-Way Multi-Stream Processing verified successfully!\n")

if __name__ == "__main__":
    test_webster_adaptive_controller()
    test_multi_stream_manager()
    print("==================================================")
    print("ALL STAGE 2 — STEP 2 AI ENGINE TESTS PASSED! 🎉")
    print("==================================================\n")
