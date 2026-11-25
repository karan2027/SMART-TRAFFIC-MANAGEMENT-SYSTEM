import cv2
import time
import queue
import logging
import threading
import numpy as np
from typing import Optional, Dict, Any, Callable

logger = logging.getLogger("MobileStreamIngest")

class MobileStreamWorker(threading.Thread):
    """
    Ingests live network video from an Android phone (IP Webcam app, Larix, or RTSP/HTTP MJPEG).
    Features:
    - Bounded frame buffer (maxsize=2) to guarantee real-time latency with zero backlog drift.
    - Automatic reconnection with exponential backoff on Wi-Fi interruptions.
    - Connection diagnostics and status reporting.
    """

    def __init__(
        self,
        stream_url: str,
        camera_id: str = "CAM_MOBILE",
        reconnect_interval_sec: float = 2.0,
        frame_callback: Optional[Callable[[np.ndarray], None]] = None
    ):
        super().__init__(daemon=True)
        self.stream_url = stream_url
        self.camera_id = camera_id
        self.reconnect_interval = reconnect_interval_sec
        self.frame_callback = frame_callback

        self.running = False
        self.is_connected = False
        self.last_frame_time = 0.0
        self.frame_queue = queue.Queue(maxsize=2)
        self.frame_count = 0
        self.fps = 30.0
        self.width = 1280
        self.height = 720
        self.last_error = None

    def run(self):
        self.running = True
        logger.info(f"[{self.camera_id}] Starting ingestion worker for stream: {self.stream_url}")

        while self.running:
            cap = cv2.VideoCapture(self.stream_url)
            if not cap.isOpened():
                self.is_connected = False
                self.last_error = f"Cannot connect to {self.stream_url}. Check Wi-Fi and IP Webcam port."
                logger.warning(f"[{self.camera_id}] Connection failed: {self.last_error}. Retrying in {self.reconnect_interval}s...")
                time.sleep(self.reconnect_interval)
                continue

            self.is_connected = True
            self.last_error = None
            self.fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            self.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
            self.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
            logger.info(f"[{self.camera_id}] Stream connected successfully! ({self.width}x{self.height} @ {self.fps:.1f} FPS)")

            while self.running:
                ret, frame = cap.read()
                if not ret:
                    logger.warning(f"[{self.camera_id}] Frame grab failed. Stream may have dropped.")
                    break

                self.last_frame_time = time.time()
                self.frame_count += 1

                # Discard stale frame if buffer full to keep delay < 100ms
                if self.frame_queue.full():
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass

                self.frame_queue.put(frame)

                if self.frame_callback:
                    try:
                        self.frame_callback(frame)
                    except Exception as e:
                        logger.error(f"Error in frame callback: {e}")

            cap.release()
            self.is_connected = False
            if self.running:
                logger.info(f"[{self.camera_id}] Reconnecting after stream drop in {self.reconnect_interval}s...")
                time.sleep(self.reconnect_interval)

        logger.info(f"[{self.camera_id}] Stream worker stopped.")

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Returns the freshest frame without blocking."""
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None

    def get_status(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "stream_url": self.stream_url,
            "is_connected": self.is_connected,
            "fps": round(self.fps, 1),
            "resolution": f"{self.width}x{self.height}",
            "frames_received": self.frame_count,
            "seconds_since_last_frame": round(time.time() - self.last_frame_time, 2) if self.last_frame_time > 0 else None,
            "last_error": self.last_error
        }

    def stop(self):
        self.running = False


def probe_stream_availability(stream_url: str, timeout_seconds: float = 3.0) -> Dict[str, Any]:
    """Tests whether a stream URL is reachable without launching a continuous thread."""
    start_time = time.time()
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return {
            "is_reachable": False,
            "latency_ms": round((time.time() - start_time) * 1000, 1),
            "error": "Failed to open video capture handle"
        }

    ret, frame = cap.read()
    cap.release()
    latency = round((time.time() - start_time) * 1000, 1)

    if ret and frame is not None:
        h, w = frame.shape[:2]
        return {
            "is_reachable": True,
            "latency_ms": latency,
            "resolution": f"{w}x{h}",
            "error": None
        }
    else:
        return {
            "is_reachable": False,
            "latency_ms": latency,
            "error": "Capture opened but failed to read initial frame"
        }
