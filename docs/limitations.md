# Documented Technical Limitations — Stage 1

## 1. Speed Estimation & Perspective Calibration
- Velocity in km/h is computed using a 2-point perspective calibration model mapping real-world reference distance (meters) to image pixel distance.
- Accuracy depends on camera elevation angle and minimal perspective distortion. If camera calibration parameters are not explicitly set for a specific video, speeds are marked as "Estimated".

## 2. Object Detection & Occlusion
- YOLOv8 vehicle detection performance depends on video lighting, weather conditions (rain, fog, night time), camera resolution, and physical vehicle occlusion (e.g. large trucks hiding smaller motorcycles).

## 3. Density & Congestion Classification Thresholds
- Density (`LOW`, `MODERATE`, `HIGH`, `VERY_HIGH`) and Congestion (`LOW`, `MODERATE`, `HIGH`, `SEVERE`) classifications in Stage 1 utilize configurable prototype decision rules based on vehicle counts inside ROI and average speed.
- These prototype thresholds are designed for demonstration and must be calibrated using real civil traffic engineering standards before operational deployment.

## 4. CCTV Access
- Stage 1 analyzes user-supplied recorded CCTV video files (`.mp4`, `.avi`, `.mov`) and does not automatically interface with proprietary government live CCTV streams.

## 5. Scope Boundary
- Stage 1 specifically processes a single fixed-camera road video stream. Multi-camera fusion, intersection signal control, city-wide route navigation, and automatic enforcement belong to future development stages.
