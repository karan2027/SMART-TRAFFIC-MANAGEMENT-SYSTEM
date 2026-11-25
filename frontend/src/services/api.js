import axios from 'axios';

const API_BASE = '/api';

// ==========================================
// ROADS & CORRIDORS
// ==========================================
export const getRoads = async () => {
  const res = await axios.get(`${API_BASE}/roads`);
  return res.data;
};

export const getRoadById = async (roadId) => {
  const res = await axios.get(`${API_BASE}/roads/${roadId}`);
  return res.data;
};

// ==========================================
// CAMERAS & MOBILE STREAM
// ==========================================
export const getCameras = async (roadId = null, junctionId = null) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (junctionId) params.junctionId = junctionId;
  const res = await axios.get(`${API_BASE}/cameras`, { params });
  return res.data;
};

export const getCameraById = async (cameraId) => {
  const res = await axios.get(`${API_BASE}/cameras/${cameraId}`);
  return res.data;
};

export const createCamera = async (data) => {
  const res = await axios.post(`${API_BASE}/cameras`, data);
  return res.data;
};

export const updateCamera = async (cameraId, data) => {
  const res = await axios.put(`${API_BASE}/cameras/${cameraId}`, data);
  return res.data;
};

export const deleteCamera = async (cameraId) => {
  const res = await axios.delete(`${API_BASE}/cameras/${cameraId}`);
  return res.data;
};

export const testCameraConnection = async (cameraId, data = {}) => {
  const res = await axios.post(`${API_BASE}/cameras/${cameraId}/test`, data);
  return res.data;
};

export const reconnectCamera = async (cameraId) => {
  const res = await axios.post(`${API_BASE}/cameras/${cameraId}/reconnect`);
  return res.data;
};

// ==========================================
// TRAFFIC READINGS & VIDEO ANALYSIS
// ==========================================
export const getTrafficReadings = async ({ roadId, cameraId, jobId, limit = 50 } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
  if (jobId) params.jobId = jobId;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/traffic/readings`, { params });
  return res.data;
};

export const getLatestReading = async ({ roadId, cameraId, jobId } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
  if (jobId) params.jobId = jobId;
  const res = await axios.get(`${API_BASE}/traffic/latest`, { params });
  return res.data;
};

export const getTrafficSummary = async ({ roadId, cameraId, jobId } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
  if (jobId) params.jobId = jobId;
  const res = await axios.get(`${API_BASE}/traffic/summary`, { params });
  return res.data;
};

export const getAnalysisJobs = async () => {
  const res = await axios.get(`${API_BASE}/analysis/jobs`);
  return res.data;
};

export const getAnalysisJobById = async (jobId) => {
  const res = await axios.get(`${API_BASE}/analysis/jobs/${jobId}`);
  return res.data;
};

export const startAnalysis = async ({ videoPath, cameraId, roadId }) => {
  const res = await axios.post(`${API_BASE}/analysis/start`, { videoPath, cameraId, roadId });
  return res.data;
};

export const uploadAndAnalyze = async (formData) => {
  const res = await axios.post(`${API_BASE}/analysis/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

// ==========================================
// JUNCTIONS & ADAPTIVE SIGNALS
// ==========================================
export const getJunctions = async () => {
  const res = await axios.get(`${API_BASE}/junctions`);
  return res.data;
};

export const getJunctionById = async (junctionId = 'JUNC001') => {
  const res = await axios.get(`${API_BASE}/junctions/${junctionId}`);
  return res.data;
};

export const updateSignalPhase = async (junctionId, data) => {
  const res = await axios.put(`${API_BASE}/junctions/${junctionId}/phase`, data);
  return res.data;
};

export const triggerEmergencyOverride = async (junctionId, data) => {
  const res = await axios.post(`${API_BASE}/junctions/${junctionId}/emergency`, data);
  return res.data;
};

export const clearEmergencyOverride = async (junctionId = 'JUNC001') => {
  const res = await axios.post(`${API_BASE}/junctions/${junctionId}/emergency/clear`);
  return res.data;
};

export const getSpatCountdown = async (junctionId = 'JUNC001') => {
  const res = await axios.get(`${API_BASE}/junctions/${junctionId}/spat`);
  return res.data;
};

export const updatePedestrianSafety = async (junctionId, data) => {
  const res = await axios.post(`${API_BASE}/junctions/${junctionId}/pedestrians`, data);
  return res.data;
};

// ==========================================
// ACCIDENTS & POLICE GEOSPATIAL DISPATCH
// ==========================================
export const getIncidents = async ({ junctionId, status, limit } = {}) => {
  const params = {};
  if (junctionId) params.junctionId = junctionId;
  if (status) params.status = status;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/incidents`, { params });
  return res.data;
};

export const reportIncident = async (data) => {
  const res = await axios.post(`${API_BASE}/incidents`, data);
  return res.data;
};

export const verifyAndDispatchIncident = async (incidentId, data = {}) => {
  const res = await axios.post(`${API_BASE}/incidents/${incidentId}/verify`, data);
  return res.data;
};

export const markIncidentFalsePositive = async (incidentId, data = {}) => {
  const res = await axios.post(`${API_BASE}/incidents/${incidentId}/false-positive`, data);
  return res.data;
};

export const getNearbyOfficers = async (lon = 77.2090, lat = 28.6139, radiusKm = 2.5) => {
  const res = await axios.get(`${API_BASE}/incidents/officers/nearby`, {
    params: { lon, lat, radiusKm }
  });
  return res.data;
};

// ==========================================
// STRAY ANIMAL & ROAD HAZARDS
// ==========================================
export const getHazards = async ({ junctionId, status } = {}) => {
  const params = {};
  if (junctionId) params.junctionId = junctionId;
  if (status) params.status = status;
  const res = await axios.get(`${API_BASE}/hazards`, { params });
  return res.data;
};

export const reportHazard = async (data) => {
  const res = await axios.post(`${API_BASE}/hazards`, data);
  return res.data;
};

export const resolveHazard = async (hazardId, data = {}) => {
  const res = await axios.post(`${API_BASE}/hazards/${hazardId}/resolve`, data);
  return res.data;
};

// ==========================================
// ANPR & VIOLATIONS & E-CHALLAN
// ==========================================
export const getANPRRecords = async ({ plateNumber, limit } = {}) => {
  const params = {};
  if (plateNumber) params.plateNumber = plateNumber;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/anpr`, { params });
  return res.data;
};

export const validatePlate = async (plate) => {
  const res = await axios.get(`${API_BASE}/anpr/validate`, { params: { plate } });
  return res.data;
};

export const getViolations = async ({ junctionId, violationType, reviewStatus, limit } = {}) => {
  const params = {};
  if (junctionId) params.junctionId = junctionId;
  if (violationType) params.violationType = violationType;
  if (reviewStatus) params.reviewStatus = reviewStatus;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/violations`, { params });
  return res.data;
};

export const recordViolation = async (data) => {
  const res = await axios.post(`${API_BASE}/violations`, data);
  return res.data;
};

export const reviewViolation = async (violationId, data) => {
  const res = await axios.put(`${API_BASE}/violations/${violationId}/review`, data);
  return res.data;
};

// ==========================================
// GREEN CORRIDORS (NETWORK GRAPH ROUTING)
// ==========================================
export const getGreenCorridors = async ({ status } = {}) => {
  const params = status ? { status } : {};
  const res = await axios.get(`${API_BASE}/corridors`, { params });
  return res.data;
};

export const planGreenRoute = async (startJunctionId, destinationJunctionId) => {
  const res = await axios.post(`${API_BASE}/corridors/plan`, { startJunctionId, destinationJunctionId });
  return res.data;
};

export const activateGreenCorridor = async (data) => {
  const res = await axios.post(`${API_BASE}/corridors/activate`, data);
  return res.data;
};

export const advanceGreenCorridor = async (corridorId) => {
  const res = await axios.post(`${API_BASE}/corridors/${corridorId}/advance`);
  return res.data;
};

// ==========================================
// TRAFFIC PREDICTIONS
// ==========================================
export const getPredictions = async (junctionId = 'JUNC001', horizonMinutes = null) => {
  const params = { junctionId };
  if (horizonMinutes) params.horizonMinutes = horizonMinutes;
  const res = await axios.get(`${API_BASE}/predictions`, { params });
  return res.data;
};

// ==========================================
// LIVE ALERTS & NOTIFICATIONS
// ==========================================
export const getAlerts = async ({ status, severity, limit = 50 } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (severity) params.severity = severity;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/alerts`, { params });
  return res.data;
};

export const createAlert = async (data) => {
  const res = await axios.post(`${API_BASE}/alerts`, data);
  return res.data;
};

export const acknowledgeAlert = async (alertId, acknowledgedBy = 'Operator') => {
  const res = await axios.put(`${API_BASE}/alerts/${alertId}/acknowledge`, { acknowledgedBy });
  return res.data;
};

export const resolveAlert = async (alertId) => {
  const res = await axios.put(`${API_BASE}/alerts/${alertId}/resolve`);
  return res.data;
};

// ==========================================
// ENVIRONMENTAL & SYSTEM HEALTH TELEMETRY
// ==========================================
export const getEnvironmentalTelemetry = async (junctionId = 'JUNC001') => {
  const res = await axios.get(`${API_BASE}/telemetry/environmental`, { params: { junctionId } });
  return res.data;
};

export const getSystemHealth = async () => {
  const res = await axios.get(`${API_BASE}/telemetry/system-health`);
  return res.data;
};
