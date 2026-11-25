import React, { useState, useEffect } from 'react';
import { getCameras, createCamera, deleteCamera, testCameraConnection, getRoads, getJunctions } from '../services/api';
import { Camera, Smartphone, Plus, Trash2, CheckCircle, AlertTriangle, RefreshCw, Radio, Info, Wifi } from 'lucide-react';

const CameraManagement = () => {
  const [cameras, setCameras] = useState([]);
  const [roads, setRoads] = useState([]);
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const [formData, setFormData] = useState({
    cameraId: '',
    name: '',
    roadId: 'ROAD_N01',
    junctionId: 'JUNC001',
    sourceType: 'mobile_stream',
    streamUrl: 'http://192.168.1.105:8080/video',
    ipAddress: '192.168.1.105',
    port: 8080,
    isMobileCamera: true,
    fps: 30
  });

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const [cRes, rRes, jRes] = await Promise.all([
        getCameras(),
        getRoads(),
        getJunctions()
      ]);
      if (cRes.success) setCameras(cRes.data);
      if (rRes.success) setRoads(rRes.data);
      if (jRes.success) setJunctions(jRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (cameraId) => {
    try {
      setTestingId(cameraId);
      setTestResult(null);
      const res = await testCameraConnection(cameraId);
      setTestResult({ cameraId, ...res });
      fetchInitial();
    } catch (err) {
      setTestResult({
        cameraId,
        success: false,
        message: err.response?.data?.message || err.message
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (cameraId) => {
    if (!window.confirm(`Are you sure you want to delete camera ${cameraId}?`)) return;
    try {
      await deleteCamera(cameraId);
      fetchInitial();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateCamera = async (e) => {
    e.preventDefault();
    try {
      await createCamera(formData);
      setShowAddModal(false);
      setFormData({
        cameraId: '',
        name: '',
        roadId: roads[0]?.roadId || 'ROAD_N01',
        junctionId: 'JUNC001',
        sourceType: 'mobile_stream',
        streamUrl: '',
        ipAddress: '',
        port: 8080,
        isMobileCamera: true,
        fps: 30
      });
      fetchInitial();
    } catch (err) {
      alert(`Failed to create camera: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Camera Hardware & Stream Management</h2>
          <p className="text-sm text-secondary">
            Configure Android mobile IP Webcam devices, RTSP CCTV streams, and assign cameras to multi-junction approaches.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} /> Register New Camera
        </button>
      </div>

      {/* Android Mobile Phone Streaming Instructions Card */}
      <div className="card p-5 mb-8 bg-surface-mint border border-medium">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand/10 rounded-lg text-brand mt-1">
            <Smartphone size={28} />
          </div>
          <div>
            <h3 className="font-bold text-base text-primary mb-1">
              📱 Android Mobile Phone Surveillance Camera Guide (IP Webcam / Larix)
            </h3>
            <p className="text-xs text-secondary leading-relaxed mb-3">
              Transform an Android smartphone into a high-definition roadside traffic surveillance camera using local Wi-Fi streaming.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-surface p-2.5 rounded border border-subtle">
                <span className="font-bold block text-primary mb-1">1. Install Application</span>
                <span className="text-muted">Install "IP Webcam" by Pavel Khlebovich from Google Play Store or Larix Broadcaster.</span>
              </div>
              <div className="bg-surface p-2.5 rounded border border-subtle">
                <span className="font-bold block text-primary mb-1">2. Connect Shared Wi-Fi</span>
                <span className="text-muted">Ensure both your computer and the Android phone are connected to the same Wi-Fi network / hotspot.</span>
              </div>
              <div className="bg-surface p-2.5 rounded border border-subtle">
                <span className="font-bold block text-primary mb-1">3. Start Server & Get URL</span>
                <span className="text-muted">Scroll down in IP Webcam and tap "Start Server". Note IP e.g. <code className="bg-canvas-subtle px-1 rounded">http://192.168.1.105:8080/video</code></span>
              </div>
              <div className="bg-surface p-2.5 rounded border border-subtle">
                <span className="font-bold block text-primary mb-1">4. Register & Verify</span>
                <span className="text-muted">Enter the IP and port below. Click "Test Connection" to verify latency & video resolution.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registered Cameras Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-subtle flex justify-between items-center">
          <h3 className="font-bold text-base">Registered Camera Devices ({cameras.length})</h3>
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchInitial}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Camera ID</th>
                <th>Name / Description</th>
                <th>Type</th>
                <th>Junction / Road</th>
                <th>Stream Endpoint</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => {
                const isTesting = testingId === cam.cameraId;
                return (
                  <tr key={cam.cameraId}>
                    <td className="font-mono text-xs font-semibold">{cam.cameraId}</td>
                    <td>
                      <span className="font-medium text-primary block">{cam.name}</span>
                      <span className="text-[11px] text-muted">{cam.resolution?.width}x{cam.resolution?.height} @ {cam.fps}fps</span>
                    </td>
                    <td>
                      {cam.isMobileCamera ? (
                        <span className="badge badge-amber text-xs flex items-center gap-1 w-fit">
                          <Smartphone size={11} /> Mobile
                        </span>
                      ) : (
                        <span className="badge badge-emerald text-xs flex items-center gap-1 w-fit">
                          <Camera size={11} /> CCTV
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-xs">{cam.junctionId || 'JUNC001'}</span>
                      <span className="text-[11px] text-muted block">{cam.roadId}</span>
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-muted font-mono">
                      {cam.streamUrl || cam.sourcePath || '—'}
                    </td>
                    <td>
                      <span className="badge badge-emerald text-xs flex items-center gap-1 w-fit">
                        <CheckCircle size={12} /> {cam.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                          onClick={() => handleTestConnection(cam.cameraId)}
                          disabled={isTesting}
                        >
                          <Radio size={12} className={isTesting ? 'animate-pulse' : ''} />
                          {isTesting ? 'Testing...' : 'Test Probe'}
                        </button>
                        <button
                          className="btn-danger text-xs py-1 px-2"
                          onClick={() => handleDelete(cam.cameraId)}
                          title="Delete Camera"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div className={`mt-4 p-4 rounded-lg border flex items-center justify-between ${
          testResult.success ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-800 dark:text-red-300'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {testResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>
              <strong>[{testResult.cameraId}]</strong> {testResult.message}
              {testResult.latencyMs && ` (Latency: ${testResult.latencyMs}ms)`}
            </span>
          </div>
          <button className="text-xs font-bold underline" onClick={() => setTestResult(null)}>Dismiss</button>
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="modal-content card p-6 max-w-lg w-full bg-surface shadow-2xl">
            <h3 className="font-bold text-xl mb-4">Register Surveillance Camera</h3>

            <form onSubmit={handleCreateCamera} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Camera Unique ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAM_MOBILE_02"
                  className="input-text w-full"
                  value={formData.cameraId}
                  onChange={(e) => setFormData({ ...formData, cameraId: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Android Field Unit Southbound"
                  className="input-text w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted block mb-1">Source Type</label>
                  <select
                    className="input-select w-full"
                    value={formData.sourceType}
                    onChange={(e) => setFormData({
                      ...formData,
                      sourceType: e.target.value,
                      isMobileCamera: e.target.value === 'mobile_stream'
                    })}
                  >
                    <option value="mobile_stream">Android IP Webcam</option>
                    <option value="rtsp_stream">RTSP IP CCTV Camera</option>
                    <option value="recorded_video">Local Pre-recorded Loop</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted block mb-1">Assigned Junction</label>
                  <select
                    className="input-select w-full"
                    value={formData.junctionId}
                    onChange={(e) => setFormData({ ...formData, junctionId: e.target.value })}
                  >
                    {junctions.map(j => (
                      <option key={j.junctionId} value={j.junctionId}>{j.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Road / Approach Assignment</label>
                <select
                  className="input-select w-full"
                  value={formData.roadId}
                  onChange={(e) => setFormData({ ...formData, roadId: e.target.value })}
                >
                  {roads.map(r => (
                    <option key={r.roadId} value={r.roadId}>{r.name} ({r.roadId})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">Stream URL / Network Endpoint</label>
                <input
                  type="text"
                  placeholder="e.g. http://192.168.1.105:8080/video or rtsp://..."
                  className="input-text w-full font-mono text-xs"
                  value={formData.streamUrl}
                  onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                />
                <span className="text-[11px] text-muted mt-1 block">
                  For Android IP Webcam, enter http://&lt;phone-ip&gt;:8080/video
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save & Register Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraManagement;
