# REST API Documentation — Intelligent Traffic Management System

Base URL: `http://localhost:5000/api`

## 1. Roads API

### `GET /api/roads`
- **Description**: Fetch all registered roads.
- **Response**: `{ "success": true, "count": 1, "data": [...] }`

### `GET /api/roads/:roadId`
- **Description**: Get road details by ID.

### `POST /api/roads`
- **Body**: `{ "roadId": "ROAD001", "name": "Expressway", "lanes": 4, "direction": "Two-Way" }`

---

## 2. Cameras API

### `GET /api/cameras`
- **Query Params**: `roadId` (optional)

### `POST /api/cameras`
- **Body**: `{ "cameraId": "CAM001", "name": "Cam 01", "roadId": "ROAD001", "sourceType": "recorded_video" }`

---

## 3. Traffic Analytics API

### `GET /api/traffic/readings`
- **Query Params**: `roadId`, `cameraId`, `start`, `end`, `limit` (default 100)

### `GET /api/traffic/latest`
- **Description**: Returns latest aggregated telemetry reading for a road/camera.

### `GET /api/traffic/summary`
- **Description**: Returns overall traffic summary (total vehicles, class breakdown, avg speed, flow rate, density, congestion).

---

## 4. Video Analysis API

### `GET /api/analysis/jobs`
- **Description**: Get historical record of video analysis jobs.

### `POST /api/analysis/start`
- **Body**: `{ "videoPath": "traffic_road_01.mp4", "cameraId": "CAM001", "roadId": "ROAD001" }`

### `POST /api/analysis/upload`
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `video` (file), `cameraId`, `roadId`
