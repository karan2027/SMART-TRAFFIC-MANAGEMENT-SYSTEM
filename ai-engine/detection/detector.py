import cv2
import numpy as np
import logging
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class VehicleDetector:
    """
    YOLO-based Vehicle Detector module.
    Detects target vehicle classes: Car (2), Motorcycle (3), Bus (5), Truck (7).
    """
    COCO_CLASS_NAMES = {
        2: "car",
        3: "motorcycle",
        5: "bus",
        7: "truck"
    }

    def __init__(self, model_name="yolov8n.pt", conf_thresh=0.35, iou_thresh=0.45, target_classes=None):
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.target_classes = target_classes or list(self.COCO_CLASS_NAMES.keys())
        
        logger.info(f"Loading YOLO model: {model_name}...")
        self.model = YOLO(model_name)
        logger.info("YOLO model loaded successfully.")

    def detect(self, frame):
        """
        Run detection on a single video frame.
        Returns list of detection dicts:
        [{'bbox': [x1, y1, x2, y2], 'confidence': float, 'class_id': int, 'class_name': str}]
        """
        results = self.model.predict(
            source=frame,
            conf=self.conf_thresh,
            iou=self.iou_thresh,
            classes=self.target_classes,
            verbose=False
        )

        detections = []
        if results and len(results) > 0 and results[0].boxes is not None:
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.COCO_CLASS_NAMES.get(cls_id, "vehicle")

                detections.append({
                    'bbox': [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                    'confidence': round(conf, 4),
                    'class_id': cls_id,
                    'class_name': cls_name
                })

        return detections
