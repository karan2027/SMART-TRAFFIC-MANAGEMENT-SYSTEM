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

        if len(detections) > 0:
            return detections

        # Fallback Motion / Blob Detector (for synthetic testing or low-contrast frames)
        if not hasattr(self, 'bg_subtractor'):
            self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=50, varThreshold=25, detectShadows=False)

        fg_mask = self.bg_subtractor.apply(frame, learningRate=0.02)
        _, thresh = cv2.threshold(fg_mask, 150, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area > 1800: # Minimum vehicle blob area
                x, y, w, h = cv2.boundingRect(cnt)
                if w < 25 or h < 35: # Ignore road lines, noise, and small artifacts
                    continue
                aspect = float(h) / max(1.0, float(w))
                
                # Calibrated dimensional thresholds for top-down & perspective traffic
                if area > 24000 or (area > 18000 and aspect > 2.4):
                    cls_name = "bus"
                    cls_id = 5
                elif area > 16000 or (area > 12000 and aspect > 2.2):
                    cls_name = "truck"
                    cls_id = 7
                elif area > 5500:
                    cls_name = "car"
                    cls_id = 2
                else:
                    cls_name = "motorcycle"
                    cls_id = 3
                
                detections.append({
                    'bbox': [float(x), float(y), float(x + w), float(y + h)],
                    'confidence': 0.85,
                    'class_id': cls_id,
                    'class_name': cls_name
                })

        return detections
