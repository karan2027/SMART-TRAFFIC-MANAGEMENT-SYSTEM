import os
import sys
import argparse
import logging
from typing import Optional, Dict
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn
import requests

from video.processor import VideoProcessor
from video.multi_stream_manager import MultiStreamManager

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s'
)
logger = logging.getLogger("TrafficAIEngine")

processor: Optional[VideoProcessor] = None
multi_stream_manager: Optional[MultiStreamManager] = None

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global processor
    logger.info("Initializing VideoProcessor & loading YOLO model...")
    config_file = os.getenv("CONFIG_PATH", "config/config.yaml")
    processor = VideoProcessor(config_path=config_file)
    logger.info("AI Engine initialized and ready.")
    yield
    global multi_stream_manager
    if multi_stream_manager:
        logger.info("Shutting down MultiStreamManager...")
        multi_stream_manager.stop()

app = FastAPI(
    title="Intelligent Traffic Management - Python AI Engine",
    version="2.0.0",
    description="Computer Vision service for single-road video analysis & Stage 2 multi-stream 4-way adaptive signal control.",
    lifespan=lifespan
)

class AnalyzeRequest(BaseModel):
    videoPath: str
    cameraId: str = "CAM001"
    roadId: str = "ROAD001"
    jobId: str = None
    callbackUrl: str = None

class JunctionStartRequest(BaseModel):
    junctionId: str = "JUNC001"
    north: str = "data/videos/traffic_road_01.mp4"
    south: str = "data/videos/v3.mp4"
    east: str = "data/videos/tv2.mp4"
    west: str = "data/videos/v4.mp4"
    backendUrl: str = "http://localhost:5000"
    syncWithBackend: bool = True

class JunctionEmergencyRequest(BaseModel):
    approach: str = "NORTH"
    vehicleType: str = "AMBULANCE"

class SimulateEmergencyRequest(BaseModel):
    approach: str = "SOUTH"
    vehicleType: str = "AMBULANCE"
    duration: float = 30.0

@app.get("/health")
def health_check():
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {
        "status": "ok",
        "service": "traffic-ai-engine",
        "modelLoaded": processor is not None,
        "device": device,
        "version": "2.0.0",
        "stage2MultiStreamActive": multi_stream_manager is not None and multi_stream_manager.running
    }

# ==========================================
# STAGE 1: SINGLE-ROAD VIDEO ANALYSIS
# ==========================================
def run_analysis_task(req: AnalyzeRequest):
    try:
        logger.info(f"Starting background processing for video: {req.videoPath}")
        
        def progress_update(pct, stage="", frame=0, total=0):
            logger.info(f"Job {req.jobId} Progress: {pct}% ({stage}) Frame {frame}/{total}")
            if req.callbackUrl and req.jobId:
                try:
                    requests.post(f"{req.callbackUrl}/progress", json={"jobId": req.jobId, "progress": pct, "stage": stage, "frame": frame, "total": total}, timeout=2)
                except Exception as e:
                    pass

        summary = processor.process(
            video_path=req.videoPath,
            camera_id=req.cameraId,
            road_id=req.roadId,
            progress_callback=progress_update
        )

        if req.callbackUrl and req.jobId:
            try:
                requests.post(f"{req.callbackUrl}/complete", json={"jobId": req.jobId, "result": summary}, timeout=5)
            except Exception as e:
                logger.error(f"Failed to post completion callback to backend: {e}")

    except Exception as e:
        logger.error(f"Error processing video {req.videoPath}: {e}", exc_info=True)
        if req.callbackUrl and req.jobId:
            try:
                requests.post(f"{req.callbackUrl}/fail", json={"jobId": req.jobId, "error": str(e)}, timeout=5)
            except Exception:
                pass

@app.post("/analyze")
def analyze_video(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(req.videoPath):
        raise HTTPException(status_code=404, detail=f"Video file not found at path: {req.videoPath}")

    background_tasks.add_task(run_analysis_task, req)
    return {
        "success": True,
        "message": "Analysis job queued successfully",
        "jobId": req.jobId,
        "videoPath": req.videoPath
    }

@app.post("/analyze-sync")
def analyze_video_sync(req: AnalyzeRequest):
    if not os.path.exists(req.videoPath):
        raise HTTPException(status_code=404, detail=f"Video file not found at path: {req.videoPath}")

    def sync_progress(pct, stage="", frame=0, total=0):
        logger.info(f"Sync Job Progress: {pct}% ({stage}) Frame {frame}/{total}")
        if req.callbackUrl and req.jobId:
            try:
                requests.post(f"{req.callbackUrl}/progress", json={"jobId": req.jobId, "progress": pct, "stage": stage, "frame": frame, "total": total}, timeout=2)
            except Exception:
                pass

    summary = processor.process(video_path=req.videoPath, camera_id=req.cameraId, road_id=req.roadId, progress_callback=sync_progress)
    return {"success": True, "data": summary}

# ==========================================
# STAGE 2: 4-WAY MULTI-STREAM & ADAPTIVE CONTROL
# ==========================================
@app.post("/junction/start")
def start_junction_simulation(req: JunctionStartRequest):
    global multi_stream_manager
    if multi_stream_manager and multi_stream_manager.running:
        multi_stream_manager.stop()

    streams = {
        "NORTH": req.north,
        "SOUTH": req.south,
        "EAST": req.east,
        "WEST": req.west
    }

    config_file = os.getenv("CONFIG_PATH", "config/config.yaml")
    multi_stream_manager = MultiStreamManager(
        stream_sources=streams,
        junction_id=req.junctionId,
        config_path=config_file,
        backend_api_url=req.backendUrl,
        sync_with_backend=req.syncWithBackend
    )
    multi_stream_manager.start()

    return {
        "success": True,
        "message": f"4-Way Multi-Stream Processing started for junction {req.junctionId}",
        "junctionId": req.junctionId,
        "streams": streams,
        "syncWithBackend": req.syncWithBackend
    }

@app.get("/junction/status")
def get_junction_status():
    global multi_stream_manager
    if not multi_stream_manager:
        raise HTTPException(status_code=400, detail="MultiStreamManager is not active. Call /junction/start first.")

    return {
        "success": True,
        "data": multi_stream_manager.get_telemetry_snapshot()
    }

@app.post("/junction/emergency")
def trigger_junction_emergency(req: JunctionEmergencyRequest):
    global multi_stream_manager
    if not multi_stream_manager:
        raise HTTPException(status_code=400, detail="MultiStreamManager is not active.")

    res = multi_stream_manager.trigger_emergency(req.approach, req.vehicleType)
    return {
        "success": True,
        "message": f"Emergency green corridor activated on {req.approach} for {req.vehicleType}",
        "data": res
    }

@app.post("/junction/emergency/clear")
def clear_junction_emergency():
    global multi_stream_manager
    if not multi_stream_manager:
        raise HTTPException(status_code=400, detail="MultiStreamManager is not active.")

    res = multi_stream_manager.clear_emergency()
    return {
        "success": True,
        "message": "Emergency override cleared. Adaptive signal control restored.",
        "data": res
    }

@app.post("/junction/simulate-emergency")
def simulate_emergency_injection(req: SimulateEmergencyRequest):
    global multi_stream_manager
    if not multi_stream_manager:
        raise HTTPException(status_code=400, detail="MultiStreamManager is not active.")
    multi_stream_manager.set_simulated_emergency(req.approach, req.vehicleType, req.duration)
    return {
        "success": True,
        "message": f"Simulated {req.vehicleType} injected on {req.approach} approach for {req.duration}s."
    }

@app.post("/junction/simulate-emergency/clear")
def clear_simulated_emergency():
    global multi_stream_manager
    if not multi_stream_manager:
        raise HTTPException(status_code=400, detail="MultiStreamManager is not active.")
    multi_stream_manager.clear_simulated_emergency()
    return {
        "success": True,
        "message": "Simulated emergency injections cleared."
    }

@app.post("/junction/stop")
def stop_junction_simulation():
    global multi_stream_manager
    if multi_stream_manager and multi_stream_manager.running:
        multi_stream_manager.stop()
        multi_stream_manager = None
        return {"success": True, "message": "MultiStreamManager stopped successfully."}
    return {"success": True, "message": "No active MultiStreamManager was running."}

# ==========================================
# CLI ENTRYPOINT
# ==========================================
def main_cli():
    parser = argparse.ArgumentParser(description="Intelligent Traffic Management AI Engine CLI")
    parser.add_argument("--video", type=str, required=False, default=None, help="Path to input CCTV traffic video (.mp4, .avi, .mov)")
    parser.add_argument("--camera", type=str, default="CAM001", help="Camera ID")
    parser.add_argument("--road", type=str, default="ROAD001", help="Road ID")
    parser.add_argument("--config", type=str, default="config/config.yaml", help="Path to YAML config file")
    parser.add_argument("--server", action="store_true", help="Launch FastAPI HTTP server")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default 8000)")

    # Stage 2 4-way junction options
    parser.add_argument("--junction", type=str, default=None, help="Run 4-way multi-stream junction CLI (e.g. JUNC001)")
    parser.add_argument("--north", type=str, default="data/videos/traffic_road_01.mp4")
    parser.add_argument("--south", type=str, default="data/videos/v3.mp4")
    parser.add_argument("--east", type=str, default="data/videos/tv2.mp4")
    parser.add_argument("--west", type=str, default="data/videos/v4.mp4")
    parser.add_argument("--duration", type=int, default=15, help="Simulation duration in seconds for CLI mode")

    args = parser.parse_args()

    if args.server:
        os.environ["CONFIG_PATH"] = args.config
        logger.info(f"Starting FastAPI AI Service on http://0.0.0.0:{args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    elif args.junction:
        # Run 4-way multi-stream in CLI mode
        logger.info(f"Starting 4-Way Multi-Stream AI Analysis on Junction {args.junction}...")
        streams = {
            "NORTH": args.north,
            "SOUTH": args.south,
            "EAST": args.east,
            "WEST": args.west
        }
        manager = MultiStreamManager(
            stream_sources=streams,
            junction_id=args.junction,
            config_path=args.config,
            sync_with_backend=False
        )
        manager.start()

        import time
        start_t = time.time()
        try:
            while time.time() - start_t < args.duration:
                time.sleep(2.0)
                snapshot = manager.get_telemetry_snapshot()
                sig = snapshot["signalControl"]
                webster = snapshot["websterCalculations"]
                print("\n" + "-"*55)
                print(f"[JUNCTION {args.junction}] ACTIVE: {sig['activeDirection']} ({sig['phaseState']}) | Remaining: {sig['remainingSeconds']}s")
                print(f"Signal States : North={sig['signalStates']['NORTH']}, South={sig['signalStates']['SOUTH']}, East={sig['signalStates']['EAST']}, West={sig['signalStates']['WEST']}")
                print(f"Queue Counts  : North={webster['queueCounts']['NORTH']}, South={webster['queueCounts']['SOUTH']}, East={webster['queueCounts']['EAST']}, West={webster['queueCounts']['WEST']}")
                print(f"Alloc Green (s): {webster['allocatedGreenSeconds']}")
                print(f"Webster Optimal Cycle: {webster['optimalCycleSeconds']}s (Total Saturation Y: {webster['totalSaturationRatio']})")
                print("-" * 55)
        finally:
            manager.stop()
            print("\n4-Way Junction Simulation Completed.")
    else:
        if not args.video:
            parser.error("Must provide --video for single-road analysis, --junction for 4-way analysis, or --server to start API.")
        vp = VideoProcessor(config_path=args.config)
        logger.info(f"Running traffic analysis on video: {args.video}")

        import json
        def cli_progress(pct, stage="", frame=0, total=0):
            print(f"PROGRESS:{json.dumps({'progress': pct, 'stage': stage, 'frame': frame, 'total': total})}", flush=True)

        summary = vp.process(video_path=args.video, camera_id=args.camera, road_id=args.road, progress_callback=cli_progress)
        print("\n" + "="*50)
        print("TRAFFIC ANALYSIS SUMMARY")
        print("="*50)
        print(f"Total Vehicles Counted : {summary['vehicles']['total']}")
        print(f"Vehicle Breakdown      : Cars={summary['vehicles']['cars']}, Motorcycles={summary['vehicles']['motorcycles']}, Buses={summary['vehicles']['buses']}, Trucks={summary['vehicles']['trucks']}")
        print(f"Average Speed          : {summary['traffic']['averageSpeedKmh']} km/h")
        print(f"Traffic Flow Rate      : {summary['traffic']['averageFlowVehiclesPerHour']} veh/hr")
        print(f"Traffic Density Level  : {summary['traffic']['densityLevel']}")
        print(f"Congestion Level       : {summary['traffic']['congestionLevel']}")
        print(f"Processed Video Output : {summary['outputs']['processedVideoPath']}")
        print("="*50 + "\n")

if __name__ == "__main__":
    if len(sys.argv) > 1 and any(arg in sys.argv for arg in ["--server", "--video", "--junction"]):
        main_cli()
    else:
        uvicorn.run(app, host="0.0.0.0", port=8000)
