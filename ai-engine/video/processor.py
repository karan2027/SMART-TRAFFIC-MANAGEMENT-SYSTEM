import os
import sys
import cv2
import json
import time
import yaml
import logging
import subprocess
import numpy as np
from datetime import datetime

# Absolute path to the project data/outputs directory, independent of CWD
_ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_OUTPUT_DIR = os.path.join(_ENGINE_DIR, '..', 'data', 'outputs')

from detection.detector import VehicleDetector
from tracking.tracker import VehicleTracker
from counting.counter import VehicleCounter
from speed.estimator import SpeedEstimator
from traffic.analyzer import TrafficAnalyzer

logger = logging.getLogger(__name__)

class VideoProcessor:
    """
    Complete Video-Based Traffic Analysis Orchestrator.
    Processes video frames, runs object detection, tracking, line counting,
    speed estimation, flow & congestion analysis, renders overlay,
    and outputs processed video + summary JSON.
    """

    def __init__(self, config_path="config/config.yaml"):
        if not os.path.isabs(config_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if os.path.exists(config_path):
                config_path = os.path.abspath(config_path)
            elif os.path.exists(os.path.join(base_dir, config_path)):
                config_path = os.path.join(base_dir, config_path)
            else:
                config_path = os.path.join(base_dir, "config", "config.yaml")
            
        self.config_path = config_path
        with open(config_path, 'r') as f:
            self.cfg = yaml.safe_load(f)

        self.detector = VehicleDetector(
            model_name=self.cfg['detection']['model_name'],
            conf_thresh=self.cfg['detection']['confidence_threshold'],
            iou_thresh=self.cfg['detection']['iou_threshold'],
            target_classes=self.cfg['detection']['target_classes']
        )
        self.tracker = VehicleTracker(
            model=self.detector.model,
            tracker_config=self.cfg['tracking']['tracker_type'],
            conf_thresh=self.cfg['detection']['confidence_threshold'],
            iou_thresh=self.cfg['detection']['iou_threshold'],
            target_classes=self.cfg['detection']['target_classes']
        )
        self.analyzer = TrafficAnalyzer(
            density_thresholds=self.cfg.get('density_thresholds'),
            congestion_thresholds=self.cfg.get('congestion_thresholds')
        )

    def validate_video(self, video_path):
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video stream for file: {video_path}")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        if frame_count <= 0 or width <= 0 or height <= 0:
            raise ValueError(f"Corrupt video file: Invalid resolution ({width}x{height}) or 0 frames.")

        return {
            'width': width,
            'height': height,
            'fps': fps if fps > 0 else 30.0,
            'frame_count': frame_count,
            'duration_seconds': round(frame_count / (fps if fps > 0 else 30.0), 2)
        }

    def process(self, video_path, camera_id="CAM001", road_id="ROAD001", output_dir=None, progress_callback=None):
        if output_dir is None:
            output_dir = os.path.normpath(_DEFAULT_OUTPUT_DIR)
        logger.info(f"Validating video: {video_path}")
        meta = self.validate_video(video_path)
        width, height, fps = meta['width'], meta['height'], meta['fps']

        # Setup ROI polygon pixel coordinates
        roi_norm = self.cfg['roi']['polygon_normalized']
        roi_poly = np.array([[int(p[0] * width), int(p[1] * height)] for p in roi_norm], dtype=np.int32)

        # Setup Counting Line pixel coordinates
        line_cfg = self.cfg['counting_line']['line_normalized']
        line_start = (int(line_cfg['start'][0] * width), int(line_cfg['start'][1] * height))
        line_end = (int(line_cfg['end'][0] * width), int(line_cfg['end'][1] * height))

        counter = VehicleCounter(
            line_coords=(line_start, line_end),
            direction_a_name=self.cfg['counting_line'].get('direction_a_label', 'Inbound'),
            direction_b_name=self.cfg['counting_line'].get('direction_b_label', 'Outbound')
        )

        # Setup Speed Estimator pixel coordinates
        calib_pts_norm = self.cfg['speed']['calibration_points_normalized']
        calib_pts = [(int(p[0] * width), int(p[1] * height)) for p in calib_pts_norm]
        speed_estimator = SpeedEstimator(
            is_calibrated=self.cfg['speed']['is_calibrated'],
            reference_distance_meters=self.cfg['speed']['reference_distance_meters'],
            calibration_points=calib_pts,
            fps=fps
        )

        os.makedirs(output_dir, exist_ok=True)
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(os.path.basename(video_path))[0]
        temp_raw_filename = f"temp_{base_name}_{timestamp_str}_raw.mp4"
        temp_raw_path = os.path.join(output_dir, temp_raw_filename)
        out_video_filename = f"{base_name}_processed_{timestamp_str}.mp4"
        out_video_path = os.path.join(output_dir, out_video_filename)
        out_json_path = os.path.join(output_dir, f"{base_name}_summary_{timestamp_str}.json")

        def notify_progress(pct, stage_msg):
            if progress_callback:
                try:
                    progress_callback(pct, stage_msg, frame_idx, meta['frame_count'])
                except TypeError:
                    try:
                        progress_callback(pct)
                    except Exception:
                        pass
                except Exception:
                    pass

        notify_progress(2, "Initializing video reader and neural network pipeline...")

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out_writer = cv2.VideoWriter(temp_raw_path, fourcc, fps, (width, height))

        cap = cv2.VideoCapture(video_path)
        frame_idx = 0
        readings = []
        all_speeds = []
        all_roi_active_counts = []
        all_frame_stationary_counts = []
        prev_counted_total = 0

        agg_interval_frames = int(self.cfg['traffic']['aggregation_interval_seconds'] * fps)
        start_time = time.time()

        logger.info(f"Processing video frames for Road {road_id} (Camera {camera_id})...")

        # Dynamic frame skipping for long videos
        user_skip = self.cfg['video'].get('frame_skip', 2)
        if meta['frame_count'] > 1000:
            frame_skip = max(user_skip, 4)
        elif meta['frame_count'] > 400:
            frame_skip = max(user_skip, 3)
        else:
            frame_skip = user_skip

        logger.info(f"Processing video ({meta['frame_count']} frames) with frame_skip={frame_skip}...")
        tracked_objects = []

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                frame_idx += 1

                # Execute detection, tracking, speed, and counting on tracking intervals
                is_tracking_frame = (frame_idx % frame_skip == 0 or frame_idx == 1)

                if is_tracking_frame:
                    detections = self.detector.detect(frame)
                    tracked_objects = self.tracker.track_frame(frame, detections)

                    # Update speeds and stationary status on tracking updates
                    for obj in tracked_objects:
                        spd_info = speed_estimator.estimate_speed(obj['track_id'], frame_idx, obj['centroid'])
                        obj['speed_kmh'] = spd_info['speed_kmh']
                        obj['speed_status'] = spd_info['status']
                        obj['is_stationary'] = spd_info.get('is_stationary', False)

                    # Run line crossing counter with stabilized vehicle class
                    tracked_objects = counter.process_tracked_objects(tracked_objects)

                # Filter ROI active & stationary vehicles in current frame
                active_in_roi = 0
                stationary_in_roi = 0
                curr_frame_speeds = []

                for obj in tracked_objects:
                    cx, cy = obj['centroid']
                    # Test ROI point
                    in_roi = cv2.pointPolygonTest(roi_poly, (float(cx), float(cy)), False) >= 0
                    if in_roi:
                        active_in_roi += 1
                        if obj.get('is_stationary', False):
                            stationary_in_roi += 1

                    spd = obj.get('speed_kmh', 0.0)
                    if spd > 0.0:
                        curr_frame_speeds.append(spd)
                        all_speeds.append(spd)

                all_roi_active_counts.append(active_in_roi)
                all_frame_stationary_counts.append(stationary_in_roi)

                # Frame Annotations & Drawing
                # 1. Draw ROI Polygon
                cv2.polylines(frame, [roi_poly], isClosed=True, color=(255, 230, 0), thickness=2)

                # 2. Draw Counting Line (High-visibility Vibrant Gold/Amber)
                cv2.line(frame, line_start, line_end, (0, 215, 255), 3)
                cv2.putText(frame, "--- COUNTING LINE ---", (line_start[0] + 10, max(25, line_start[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (0, 215, 255), 1, cv2.LINE_AA)

                # 3. Draw Vehicle Bounding Boxes & High-Contrast Text Badges
                for obj in tracked_objects:
                    x1, y1, x2, y2 = [int(v) for v in obj['bbox']]
                    t_id = obj['track_id']
                    c_name = obj['class_name']
                    speed = obj.get('speed_kmh', 0.0)
                    spd_lbl = "Est" if obj.get('speed_status') == 'estimated' else "Calib"
                    is_stop = obj.get('is_stationary', False)
                    crossed = obj.get('crossed_counting_line', False)

                    if is_stop:
                        box_color = (40, 50, 240) # Vivid Alert Red for stationary vehicles
                        label_text = f"#{t_id} {c_name} {speed}km/h [STOPPED]"
                    elif crossed:
                        box_color = (60, 220, 50) # Vivid Emerald Green for counted line crossed
                        label_text = f"#{t_id} {c_name} {speed}km/h [COUNTED]"
                    else:
                        box_color = (255, 185, 25) # Vivid Electric Sky Blue for active corridor tracked
                        label_text = f"#{t_id} {c_name} {speed}km/h ({spd_lbl})"

                    # Draw Bounding Box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

                    # Draw High-Contrast Text Badge (Solid dark backing + status color border)
                    (t_w, t_h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
                    badge_h = t_h + 8
                    badge_w = t_w + 12
                    b_y1 = max(0, y1 - badge_h)
                    b_y2 = b_y1 + badge_h
                    b_x1 = max(0, x1)
                    b_x2 = min(width - 1, b_x1 + badge_w)

                    # Badge dark backing
                    cv2.rectangle(frame, (b_x1, b_y1), (b_x2, b_y2), (14, 17, 23), -1)
                    # Colored border matching status
                    cv2.rectangle(frame, (b_x1, b_y1), (b_x2, b_y2), box_color, 1)
                    # Left color indicator accent bar
                    cv2.rectangle(frame, (b_x1, b_y1), (b_x1 + 4, b_y2), box_color, -1)
                    # Crisp white text with antialiasing
                    cv2.putText(frame, label_text, (b_x1 + 8, b_y2 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)

                    # Centroid Dot with high-contrast ring
                    cv2.circle(frame, obj['centroid'], 4, box_color, -1)
                    cv2.circle(frame, obj['centroid'], 5, (255, 255, 255), 1)

                # Current cumulative metrics
                counts = counter.get_counts()
                total_monitored_corridor = len(self.tracker.all_seen_tracks)
                avg_frame_speed = float(np.mean(curr_frame_speeds)) if len(curr_frame_speeds) > 0 else 0.0
                curr_density = self.analyzer.determine_density_level(active_in_roi)
                curr_congestion = self.analyzer.determine_congestion_level(avg_frame_speed, curr_density)

                # 4. Draw Comprehensive 3-Line HUD Overlay (STMS Branding)
                cv2.rectangle(frame, (0, 0), (width, 88), (14, 17, 23), -1)
                
                hud_line1 = (
                    f"STMS: SMART TRAFFIC MANAGEMENT | ROAD: {road_id} | CAM: {camera_id} | "
                    f"MONITORED: {total_monitored_corridor} | LINE CROSSED: {counts['total']}"
                )
                cv2.putText(frame, hud_line1, (15, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2, cv2.LINE_AA)

                hud_line2 = (
                    f"CORRIDOR SPD: {avg_frame_speed:.1f} km/h | DENSITY: {curr_density} | CONGESTION: {curr_congestion} | "
                    f"QUEUE IN ROI: {active_in_roi} | STOPPED: {stationary_in_roi}"
                )
                cong_color = (40, 50, 240) if curr_congestion in ["HIGH", "SEVERE"] else ((0, 215, 255) if curr_congestion == "MODERATE" else (60, 220, 50))
                cv2.putText(frame, hud_line2, (15, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.52, cong_color, 2, cv2.LINE_AA)

                hud_line3 = (
                    f"TYPES CROSSED -> Cars: {counts['car']} | Bikes: {counts['motorcycle']} | "
                    f"Buses: {counts['bus']} | Trucks: {counts['truck']} | DIR A: {counts['direction_a']} DIR B: {counts['direction_b']}"
                )
                cv2.putText(frame, hud_line3, (15, 78), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 210, 225), 1, cv2.LINE_AA)

                out_writer.write(frame)

                # Aggregation Reading Interval Check (e.g. Every 10 seconds)
                if frame_idx % agg_interval_frames == 0 or frame_idx == meta['frame_count']:
                    window_crossings = counts['total'] - prev_counted_total
                    prev_counted_total = counts['total']
                    reading = self.analyzer.aggregate_reading(
                        interval_seconds=self.cfg['traffic']['aggregation_interval_seconds'],
                        new_crossings=window_crossings,
                        active_in_roi=active_in_roi,
                        speeds=curr_frame_speeds
                    )
                    reading.update({
                        'timestamp': datetime.now().isoformat(),
                        'frame': frame_idx,
                        'cameraId': camera_id,
                        'roadId': road_id,
                        'cumulativeCounts': dict(counts),
                        'directionCounts': {
                            'directionA': counts['direction_a'],
                            'directionB': counts['direction_b']
                        },
                        'activeInRoi': active_in_roi,
                        'stationaryInRoi': stationary_in_roi,
                        'uniqueMonitoredCorridor': total_monitored_corridor
                    })
                    readings.append(reading)

                if frame_idx % 10 == 0 or frame_idx == meta['frame_count']:
                    calc_pct = min(88, max(3, int((frame_idx / meta['frame_count']) * 88)))
                    notify_progress(calc_pct, f"Analyzing frame {frame_idx} of {meta['frame_count']}")

        finally:
            cap.release()
            out_writer.release()

        notify_progress(90, "Calculating traffic density and speed statistics...")

        processing_duration = round(time.time() - start_time, 2)
        overall_counts = counter.get_counts()
        overall_avg_speed = round(float(np.mean(all_speeds)), 1) if len(all_speeds) > 0 else 0.0

        # Calculate genuine spatial density across monitored corridor frames
        avg_roi_density = int(round(np.mean(all_roi_active_counts))) if len(all_roi_active_counts) > 0 else 0
        peak_roi_density = int(np.max(all_roi_active_counts)) if len(all_roi_active_counts) > 0 else 0
        final_density = self.analyzer.determine_density_level(avg_roi_density)
        final_congestion = self.analyzer.determine_congestion_level(overall_avg_speed, final_density)

        corridor_summary = self.tracker.get_corridor_summary()
        stationary_stats = speed_estimator.get_stationary_stats()

        notify_progress(93, "Encoding web-compatible H.264 video stream...")

        # Transcode temp_raw_path to out_video_path using ffmpeg (H.264 +faststart)
        h264_success = False
        try:
            cmd = [
                'ffmpeg', '-y',
                '-i', temp_raw_path,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'fast',
                '-crf', '23',
                '-movflags', '+faststart',
                out_video_path
            ]
            ff_res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
            if ff_res.returncode == 0 and os.path.exists(out_video_path) and os.path.getsize(out_video_path) > 1000:
                h264_success = True
                try:
                    os.remove(temp_raw_path)
                except OSError:
                    pass
            else:
                logger.warning(f"FFmpeg transcode returned non-zero code {ff_res.returncode}: {ff_res.stderr[:200]}")
        except Exception as ff_err:
            logger.warning(f"FFmpeg transcode exception: {ff_err}")

        if not h264_success:
            logger.info("Using raw OpenCV MP4 output as fallback.")
            if os.path.exists(out_video_path):
                try:
                    os.remove(out_video_path)
                except OSError:
                    pass
            if os.path.exists(temp_raw_path):
                os.rename(temp_raw_path, out_video_path)

        notify_progress(98, "Writing traffic summary and telemetry JSON...")

        summary_data = {
            'cameraId': camera_id,
            'roadId': road_id,
            'analysisVersion': '1.0.0',
            'video': {
                'filename': os.path.basename(video_path),
                'durationSeconds': meta['duration_seconds'],
                'fps': fps,
                'width': width,
                'height': height,
                'totalFrames': meta['frame_count']
            },
            'performance': {
                'processingDurationSeconds': processing_duration,
                'processingFps': round(meta['frame_count'] / max(0.1, processing_duration), 2)
            },
            'vehicles': {
                'total': overall_counts['total'],
                'cars': overall_counts['car'],
                'motorcycles': overall_counts['motorcycle'],
                'buses': overall_counts['bus'],
                'trucks': overall_counts['truck'],
                'lineCrossings': {
                    'total': overall_counts['total'],
                    'cars': overall_counts['car'],
                    'motorcycles': overall_counts['motorcycle'],
                    'buses': overall_counts['bus'],
                    'trucks': overall_counts['truck']
                },
                'corridorMonitored': {
                    'total': corridor_summary['total_unique'],
                    'cars': corridor_summary['by_class']['car'],
                    'motorcycles': corridor_summary['by_class']['motorcycle'],
                    'buses': corridor_summary['by_class']['bus'],
                    'trucks': corridor_summary['by_class']['truck']
                },
                'stationaryVehiclesCount': stationary_stats['total_stationary_detected'],
                'peakRoiDensity': peak_roi_density,
                'averageRoiDensity': avg_roi_density
            },
            'traffic': {
                'averageSpeedKmh': overall_avg_speed,
                'averageFlowVehiclesPerHour': self.analyzer.calculate_flow_rate(overall_counts['total'], meta['duration_seconds']),
                'densityLevel': final_density,
                'congestionLevel': final_congestion,
                'peakRoiDensity': peak_roi_density,
                'averageRoiDensity': avg_roi_density,
                'stationaryCount': stationary_stats['total_stationary_detected'],
                'directionData': {
                    'directionA': overall_counts['direction_a'],
                    'directionB': overall_counts['direction_b']
                }
            },
            'outputs': {
                'processedVideoFilename': out_video_filename,
                'processedVideoPath': out_video_path,
                'summaryJsonPath': out_json_path
            },
            'readings': readings
        }

        with open(out_json_path, 'w') as f:
            json.dump(summary_data, f, indent=2)

        notify_progress(100, "Analysis completed successfully")
        logger.info(f"Analysis complete for {video_path}. Output saved to {out_video_path}")
        return summary_data
