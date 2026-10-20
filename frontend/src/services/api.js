import axios from 'axios';

const API_BASE = '/api';

export const getRoads = async () => {
  const res = await axios.get(`${API_BASE}/roads`);
  return res.data;
};

export const getRoadById = async (roadId) => {
  const res = await axios.get(`${API_BASE}/roads/${roadId}`);
  return res.data;
};

export const getCameras = async (roadId = null) => {
  const params = roadId ? { roadId } : {};
  const res = await axios.get(`${API_BASE}/cameras`, { params });
  return res.data;
};

export const getTrafficReadings = async ({ roadId, cameraId, limit = 50 } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/traffic/readings`, { params });
  return res.data;
};

export const getLatestReading = async ({ roadId, cameraId } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
  const res = await axios.get(`${API_BASE}/traffic/latest`, { params });
  return res.data;
};

export const getTrafficSummary = async ({ roadId, cameraId } = {}) => {
  const params = {};
  if (roadId) params.roadId = roadId;
  if (cameraId) params.cameraId = cameraId;
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
