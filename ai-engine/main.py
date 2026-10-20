import os
import sys
import argparse
import logging
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn
import requests

from video.processor import VideoProcessor

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s'
)
logger = logging.getLogger("TrafficAIEngine")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global processor
    logger.info("Initializing VideoProcessor & loading YOLO model...")
    config_file = os.getenv("CONFIG_PATH", "config/config.yaml")
    processor = VideoProcessor(config_path=config_file)
    logger.info("AI Engine initialized and ready.")
    yield

app = FastAPI(
    title="Intelligent Traffic Management - Python AI Engine",
    version="1.0.0",
    description="Computer Vision service for vehicle detection, tracking, counting, speed estimation, flow rate, density, and congestion classification.",
    lifespan=lifespan
)

class AnalyzeRequest(BaseModel):
    videoPath: str
    cameraId: str = "CAM001"
    roadId: str = "ROAD001"
    jobId: str = None
    callbackUrl: str = None

@app.get("/health")
def health_check():
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {
        "status": "ok",
        "service": "traffic-ai-engine",
        "modelLoaded": processor is not None,
        "device": device,
        "version": "1.0.0"
    }

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

def main_cli():
    parser = argparse.ArgumentParser(description="Intelligent Traffic Management AI Engine CLI")
    parser.add_argument("--video", type=str, required=False, default=None, help="Path to input CCTV traffic video (.mp4, .avi, .mov)")
    parser.add_argument("--camera", type=str, default="CAM001", help="Camera ID")
    parser.add_argument("--road", type=str, default="ROAD001", help="Road ID")
    parser.add_argument("--config", type=str, default="config/config.yaml", help="Path to YAML config file")
    parser.add_argument("--server", action="store_true", help="Launch FastAPI HTTP server")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default 8000)")

    args = parser.parse_args()

    if args.server:
        os.environ["CONFIG_PATH"] = args.config
        logger.info(f"Starting FastAPI AI Service on http://0.0.0.0:{args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    else:
        if not args.video:
            parser.error("the following arguments are required: --video (or use --server to start the API server)")
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
    if len(sys.argv) > 1 and "--server" in sys.argv:
        main_cli()
    elif len(sys.argv) > 1 and "--video" in sys.argv:
        main_cli()
    else:
        # Default fallback: launch HTTP server
        uvicorn.run(app, host="0.0.0.0", port=8000)
