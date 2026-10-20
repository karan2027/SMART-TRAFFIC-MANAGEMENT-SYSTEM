import numpy as np
import logging

logger = logging.getLogger(__name__)

class VehicleTracker:
    """
    Multi-Object Vehicle Tracker.
    Primary: YOLO ByteTrack / BoT-SORT persistent tracking.
    Fallback: Euclidean Centroid Distance Association for custom/motion detections.
    """

    def __init__(self, model, tracker_config="bytetrack.yaml", conf_thresh=0.35, iou_thresh=0.45, target_classes=None):
        self.model = model
        self.tracker_config = tracker_config
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.target_classes = target_classes or [2, 3, 5, 7]
        self.COCO_CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

        # Centroid tracker fallback state
        self.next_fallback_id = 100
        self.prev_centroids = {} # track_id -> (cx, cy)
        self.disappeared = {} # track_id -> frames missing

        # Temporal Majority Class Voting & Lifetime Corridor Tracking
        self.class_votes = {} # track_id -> {cls_name: accumulated_conf}
        self.all_seen_tracks = {} # track_id -> {'stable_class': str, 'best_conf': float, 'appearances': int}

    def _update_class_stability(self, t_id, cls_name, conf=0.8):
        """
        Maintains temporal class voting histogram to eliminate classification jitter and flipping.
        """
        if t_id not in self.class_votes:
            self.class_votes[t_id] = {}
            self.all_seen_tracks[t_id] = {
                'track_id': t_id,
                'stable_class': cls_name,
                'best_conf': float(conf),
                'appearances': 0
            }

        weight = max(0.1, float(conf))
        self.class_votes[t_id][cls_name] = self.class_votes[t_id].get(cls_name, 0.0) + weight
        self.all_seen_tracks[t_id]['appearances'] += 1
        if conf > self.all_seen_tracks[t_id]['best_conf']:
            self.all_seen_tracks[t_id]['best_conf'] = float(conf)

        # Get stabilized class with highest accumulated confidence
        stable_class = max(self.class_votes[t_id].items(), key=lambda x: x[1])[0]
        self.all_seen_tracks[t_id]['stable_class'] = stable_class
        return stable_class

    def get_corridor_summary(self):
        """
        Return total unique vehicles monitored across the entire corridor and class breakdown.
        """
        summary = {
            'total_unique': len(self.all_seen_tracks),
            'by_class': {
                'car': 0,
                'motorcycle': 0,
                'bus': 0,
                'truck': 0
            }
        }
        for info in self.all_seen_tracks.values():
            s_cls = info.get('stable_class', 'car')
            if s_cls in summary['by_class']:
                summary['by_class'][s_cls] += 1
            else:
                summary['by_class']['car'] += 1
        return summary

    def track_frame(self, frame, input_detections=None):
        """
        Track vehicles in a single frame.
        input_detections: list of detections from VehicleDetector.detect(frame)
        """
        tracked_objects = []

        # Try YOLO ByteTrack first
        try:
            results = self.model.track(
                source=frame,
                persist=True,
                tracker=self.tracker_config,
                conf=self.conf_thresh,
                iou=self.iou_thresh,
                classes=self.target_classes,
                verbose=False
            )

            if results and len(results) > 0 and results[0].boxes is not None and len(results[0].boxes) > 0:
                boxes = results[0].boxes
                track_ids = boxes.id.int().cpu().numpy() if boxes.id is not None else list(range(len(boxes)))

                for i, box in enumerate(boxes):
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    raw_cls_name = self.COCO_CLASS_NAMES.get(cls_id, "vehicle")
                    t_id = int(track_ids[i])

                    # Apply temporal class stabilization
                    stable_cls_name = self._update_class_stability(t_id, raw_cls_name, conf)

                    cx = int((x1 + x2) / 2.0)
                    cy = int((y1 + y2) / 2.0)

                    tracked_objects.append({
                        'track_id': t_id,
                        'bbox': [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                        'centroid': (cx, cy),
                        'class_id': cls_id,
                        'class_name': stable_cls_name,
                        'confidence': round(conf, 4)
                    })
                return tracked_objects
        except Exception as e:
            logger.debug(f"YOLO track exception: {e}")

        # Centroid Tracking Fallback for input_detections
        if not input_detections or len(input_detections) == 0:
            return tracked_objects

        input_centroids = [
            (int((d['bbox'][0] + d['bbox'][2]) / 2.0), int((d['bbox'][1] + d['bbox'][3]) / 2.0))
            for d in input_detections
        ]

        if len(self.prev_centroids) == 0:
            for i, d in enumerate(input_detections):
                t_id = self.next_fallback_id
                self.next_fallback_id += 1
                self.prev_centroids[t_id] = input_centroids[i]
                self.disappeared[t_id] = 0

                stable_cls = self._update_class_stability(t_id, d.get('class_name', 'car'), d.get('confidence', 0.85))

                tracked_objects.append({
                    'track_id': t_id,
                    'bbox': d['bbox'],
                    'centroid': input_centroids[i],
                    'class_id': d.get('class_id', 2),
                    'class_name': stable_cls,
                    'confidence': d.get('confidence', 0.85)
                })
            return tracked_objects

        # Associate existing centroids with new input_centroids
        object_ids = list(self.prev_centroids.keys())
        prev_pts = list(self.prev_centroids.values())

        # Compute pairwise Euclidean distances
        D = np.linalg.norm(np.array(prev_pts)[:, np.newaxis] - np.array(input_centroids), axis=2)

        rows = D.min(axis=1).argsort()
        cols = D.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()

        for (row, col) in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue
            if D[row, col] > 120.0: # Max association distance pixels
                continue

            t_id = object_ids[row]
            self.prev_centroids[t_id] = input_centroids[col]
            self.disappeared[t_id] = 0
            used_rows.add(row)
            used_cols.add(col)

            d = input_detections[col]
            stable_cls = self._update_class_stability(t_id, d.get('class_name', 'car'), d.get('confidence', 0.85))

            tracked_objects.append({
                'track_id': t_id,
                'bbox': d['bbox'],
                'centroid': input_centroids[col],
                'class_id': d.get('class_id', 2),
                'class_name': stable_cls,
                'confidence': d.get('confidence', 0.85)
            })

        # Register new detections
        unused_cols = set(range(len(input_centroids))).difference(used_cols)
        for col in unused_cols:
            t_id = self.next_fallback_id
            self.next_fallback_id += 1
            self.prev_centroids[t_id] = input_centroids[col]
            self.disappeared[t_id] = 0

            d = input_detections[col]
            stable_cls = self._update_class_stability(t_id, d.get('class_name', 'car'), d.get('confidence', 0.85))

            tracked_objects.append({
                'track_id': t_id,
                'bbox': d['bbox'],
                'centroid': input_centroids[col],
                'class_id': d.get('class_id', 2),
                'class_name': stable_cls,
                'confidence': d.get('confidence', 0.85)
            })

        return tracked_objects
