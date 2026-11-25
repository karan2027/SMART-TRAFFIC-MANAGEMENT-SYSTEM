import React, { useState, useEffect } from 'react';
import { getCameras, getJunctionById } from '../services/api';
import { Video, RefreshCw, Smartphone, Camera, Radio, CheckCircle, AlertCircle, Eye } from 'lucide-react';

const LiveCameras = () => {
  const [cameras, setCameras] = useState([]);
  const [selectedJunction, setSelectedJunction] = useState('JUNC001');
  const [junctionData, setJunctionData] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [selectedJunction]);

  const fetchData = async () => {
    try {
      const [cRes, jRes] = await Promise.all([
        getCameras(),
        getJunctionById(selectedJunction)
      ]);
      if (cRes.success) setCameras(cRes.data);
      if (jRes.success) {
        setJunctionData(jRes.data);
        if (!selectedCamera && cRes.data.length > 0) {
          setSelectedCamera(cRes.data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching live feeds:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Camera Monitoring & Mobile Feeds</h2>
          <p className="text-sm text-secondary">
            Multi-stream neural perception ingestion supporting Android IP Webcam, RTSP CCTV, and local feeds.
          </p>
        </div>
        <div className="flex gap-3">
          <select
            className="input-select"
            value={selectedJunction}
            onChange={(e) => setSelectedJunction(e.target.value)}
          >
            <option value="JUNC001">Grand Cross (JUNC001)</option>
            <option value="JUNC002">Metro Hub (JUNC002)</option>
          </select>
          <button className="btn-secondary flex items-center gap-2" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh Feeds
          </button>
        </div>
      </div>

      {/* Main Focus Feed + Telemetry Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="live-indicator-dot"></span>
              <span className="font-semibold text-primary">
                {selectedCamera ? selectedCamera.name : 'Primary Feed'}
              </span>
              {selectedCamera?.isMobileCamera && (
                <span className="badge badge-amber flex items-center gap-1 text-xs">
                  <Smartphone size={12} /> Mobile Stream
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              {selectedCamera?.resolution?.width}x{selectedCamera?.resolution?.height} @ {selectedCamera?.fps} FPS
            </div>
          </div>

          <div className="video-player-box relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[360px]">
            {selectedCamera?.sourcePath ? (
              <video
                key={selectedCamera.cameraId}
                src={`/${selectedCamera.sourcePath}`}
                controls
                autoPlay
                loop
                muted
                className="w-full h-full object-cover max-h-[420px]"
              />
            ) : selectedCamera?.streamUrl ? (
              <div className="text-center p-6">
                <Radio size={48} className="mx-auto mb-2 text-brand animate-pulse" />
                <p className="font-semibold text-white">Live Stream Ingest Active</p>
                <p className="text-xs text-gray-400 mt-1">{selectedCamera.streamUrl}</p>
                <span className="badge badge-emerald mt-3">Connected (Sub-100ms)</span>
              </div>
            ) : (
              <div className="text-center p-6 text-gray-400">
                <Video size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a camera feed to view</p>
              </div>
            )}

            {/* AI HUD Overlay simulation */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded text-xs text-white border border-white/10">
              <span className="text-emerald-400 font-mono">YOLOv8 + ByteTrack</span> | Active Vehicles: 6 | Latency: 42ms
            </div>
          </div>
        </div>

        {/* Selected Feed Telemetry */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-3">Feed Telemetry & AI Parsing</h3>
            <div className="space-y-3">
              <div className="info-row">
                <span className="text-muted text-xs">Camera ID:</span>
                <span className="font-mono text-sm font-semibold">{selectedCamera?.cameraId || '—'}</span>
              </div>
              <div className="info-row">
                <span className="text-muted text-xs">Bound Road / Approach:</span>
                <span className="text-sm font-medium">{selectedCamera?.roadId || 'ROAD001'}</span>
              </div>
              <div className="info-row">
                <span className="text-muted text-xs">Ingest Protocol:</span>
                <span className="badge badge-muted text-xs uppercase">{selectedCamera?.sourceType || 'RECORDED_VIDEO'}</span>
              </div>
              <div className="info-row">
                <span className="text-muted text-xs">Health Status:</span>
                <span className="badge badge-emerald text-xs flex items-center gap-1">
                  <CheckCircle size={12} /> ONLINE
                </span>
              </div>
            </div>

            <hr className="my-4 border-subtle" />

            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Detection Breakdown</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-canvas-subtle p-2 rounded">
                <span className="text-muted block">Cars</span>
                <span className="text-lg font-bold text-primary">4</span>
              </div>
              <div className="bg-canvas-subtle p-2 rounded">
                <span className="text-muted block">Two-Wheelers</span>
                <span className="text-lg font-bold text-teal">2</span>
              </div>
              <div className="bg-canvas-subtle p-2 rounded">
                <span className="text-muted block">Buses</span>
                <span className="text-lg font-bold text-amber">0</span>
              </div>
              <div className="bg-canvas-subtle p-2 rounded">
                <span className="text-muted block">Avg Speed</span>
                <span className="text-lg font-bold text-emerald">32 km/h</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-subtle">
            <span className="text-xs text-muted block mb-1">Assigned Junction Phase:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {junctionData?.activeDirection || 'NORTH'} GREEN ({junctionData?.currentPhaseState || 'ACTIVE'})
            </span>
          </div>
        </div>
      </div>

      {/* Grid of all Available Cameras */}
      <h3 className="text-lg font-bold mb-4">All Active Feeds ({cameras.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cameras.map((cam) => {
          const isSelected = selectedCamera?.cameraId === cam.cameraId;
          return (
            <div
              key={cam.cameraId}
              onClick={() => setSelectedCamera(cam)}
              className={`card p-3 cursor-pointer transition-all border-2 ${
                isSelected ? 'border-brand shadow-md bg-surface-mint' : 'border-transparent hover:border-medium'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold truncate max-w-[150px]">{cam.name}</span>
                {cam.isMobileCamera ? (
                  <span className="badge badge-amber text-[10px] py-0.5">Mobile</span>
                ) : (
                  <span className="badge badge-emerald text-[10px] py-0.5">CCTV</span>
                )}
              </div>
              <div className="bg-video-bg rounded aspect-video flex items-center justify-center text-white/50 text-xs overflow-hidden">
                {cam.sourcePath ? (
                  <video src={`/${cam.sourcePath}`} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera size={24} className="mb-1 text-white/70" />
                    <span>Live Stream</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-2 text-[11px] text-muted">
                <span>{cam.roadId}</span>
                <span className="text-emerald font-semibold">● ONLINE</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveCameras;
