# System Architecture & Design — Intelligent Traffic Management System (Stage 1)

## 1. High-Level Architecture Overview

Stage 1 implements a decoupled 3-tier architecture:

```text
               +----------------------------------+
               |        REACT DASHBOARD UI        |
               | (Vite, React Router, Recharts)   |
               +----------------+-----------------+
                                |
                                | REST APIs
                                v
               +----------------+-----------------+
               |       NODE.JS EXPRESS BACKEND    |
               |     (Mongoose / Mongo DB)        |
               +----------------+-----------------+
                                |
                                | Child Process / HTTP API
                                v
               +----------------+-----------------+
               |      PYTHON AI COMPUTER VISION   |
               |   (OpenCV, YOLOv8, ByteTrack)    |
               +----------------------------------+
```

## 2. Computer Vision Pipeline

```text
Input Video (.mp4/.avi/.mov)
    |
    v
Video Processing & Validation (OpenCV frame extraction, FPS, resolution check)
    |
    v
YOLOv8 Detection (Vehicle detection: Car, Motorcycle, Bus, Truck)
    |
    v
Multi-Object Tracker (ByteTrack persistent track_id association)
    |
    v
ROI Polygon & Virtual Counting Line Crossing (Intersection test & unique track_id counter)
    |
    v
Direction Analysis (Vector cross product classification: Direction A vs Direction B)
    |
    v
Calibrated Speed Estimator (2-point perspective calibration pixel-to-meter conversion)
    |
    v
Traffic Analytics Engine (Traffic Flow Rate vph, Density level, Congestion level classification)
    |
    v
Output Generators (Annotated output video with HUD + Summary JSON + MongoDB Persistence)
```

## 3. Road-to-City Hierarchy Vision

Stage 1 establishes the foundational schema supporting future multi-scale expansion:

```text
Stage 1: Road (ROAD001) -> Camera (CAM001) -> TrafficReading
Future : City -> Zone -> Junction -> Road -> Camera -> TrafficReading
```
