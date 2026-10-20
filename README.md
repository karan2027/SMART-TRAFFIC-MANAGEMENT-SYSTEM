# Smart Traffic Management System (STMS) — Stage 1

> **Major B.Tech Final-Year Computer Science Engineering Project**  
> **Stage 1: Detection and Recognition — Recorded Video Traffic Analysis System**

---

## 📌 System Architecture

```text
                    RECORDED CCTV VIDEO
                            |
                            v
                    VIDEO PROCESSING
                         OpenCV
                            |
                            v
                    VEHICLE DETECTION
                          YOLOv8
                            |
                            v
                    VEHICLE TRACKING
                   ByteTrack / BoT-SORT
                            |
                            v
                 VEHICLE CLASSIFICATION
               (Car, Motorcycle, Bus, Truck)
                            |
                            v
                    VEHICLE COUNTING
                 (Virtual Crossing Line)
                            |
                            v
                    DIRECTION ANALYSIS
                  (Direction A / Direction B)
                            |
                            v
                    SPEED ESTIMATION
                 (Calibrated 2-Point m/s -> km/h)
                            |
                            v
                 TRAFFIC FLOW & DENSITY
                (Vehicles/Hour & ROI Occupancy)
                            |
                            v
                   CONGESTION ANALYSIS
               (Rule-based decision engine)
                            |
             +--------------+--------------+
             |                             |
             v                             v
       MONGODB DATABASE               SUMMARY JSON
             |                             |
             +--------------+--------------+
                            |
                            v
                     BACKEND REST API
                        Node.js / Express
                            |
                            v
                    REACT DASHBOARD
                Vite + Recharts + Plain CSS
```

---

## 🛠️ Tech Stack & Versions

- **Frontend**: React 18.3, Vite 5.2, React Router DOM 6.23, Recharts 2.12, Plain CSS
- **Backend API**: Node.js v24.14, Express 4.19, Mongoose 8.3, MongoDB Memory Server (fallback)
- **AI Engine**: Python 3.13, OpenCV 5.0, Ultralytics YOLOv8 8.4, PyTorch 2.14, FastAPI 0.142
- **Data Storage**: MongoDB `Road`, `Camera`, `TrafficReading`, `AnalysisJob`

---

## 🚀 Quick Start Instructions

### 1. Generate Synthetic Sample Traffic Video
```bash
python data/create_sample_video.py
```

### 2. Run Python AI Analysis Pipeline (CLI Mode)
```bash
python ai-engine/main.py --video data/videos/traffic_road_01.mp4 --camera CAM001 --road ROAD001
```

### 3. Launch Backend API Server
```bash
cd backend
npm run dev
```

### 4. Launch React Control Dashboard
```bash
cd frontend
npm run dev
```
Access dashboard at `http://localhost:3000`.

---

## 📄 Documentation
- [Architecture & Design](docs/architecture.md)
- [REST API Reference](docs/api.md)
- [Setup & Installation](docs/setup.md)
- [Documented Limitations](docs/limitations.md)
