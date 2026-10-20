import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Upload, Play, CheckCircle2, AlertCircle, FileText, 
  Cpu, RotateCcw, Download, Copy, Check, FileVideo, Film 
} from 'lucide-react';
import JobProgressBar from '../components/JobProgressBar';
import StatusBadge from '../components/StatusBadge';
import { startAnalysis, uploadAndAnalyze, getAnalysisJobById } from '../services/api';

const PRELOADED_VIDEOS = [
  { value: 'traffic_road_01.mp4', label: 'traffic_road_01.mp4 (Corridor Sample, 12s)' },
  { value: 'v3.mp4', label: 'v3.mp4 (Real CCTV: Heavy Congestion Queue, 15s)' },
  { value: 'v1.mp4', label: 'v1.mp4 (Real CCTV: Urban Arterial Flow, 15s)' },
  { value: 'v2.mp4', label: 'v2.mp4 (Real CCTV: Multi-Lane Transit, 10s)' },
  { value: 'tv3.mp4', label: 'tv3.mp4 (Arterial Junction Stream, 48s)' },
  { value: 'tv2.mp4', label: 'tv2.mp4 (Urban Highway Stream, 48s)' }
];

const VideoAnalysis = () => {
  const [selectedVideo, setSelectedVideo] = useState('traffic_road_01.mp4');
  const [roadId, setRoadId] = useState('ROAD001');
  const [cameraId, setCameraId] = useState('CAM001');
  const [uploadFile, setUploadFile] = useState(null);

  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'json'
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  // Poll job status if queued or processing
  useEffect(() => {
    let interval = null;
    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const res = await getAnalysisJobById(activeJob.jobId);
          if (res.success && res.data) {
            setActiveJob(res.data);
            if (res.data.status === 'completed' || res.data.status === 'failed') {
              clearInterval(interval);
              setLoading(false);
            }
          }
        } catch (e) {
          console.warn('Poll error:', e);
        }
      }, 1500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeJob]);

  const handleStartAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      if (uploadFile) {
        const formData = new FormData();
        formData.append('video', uploadFile);
        formData.append('roadId', roadId);
        formData.append('cameraId', cameraId);

        const res = await uploadAndAnalyze(formData);
        if (res.success) {
          setActiveJob(res.data);
        } else {
          setError(res.message || 'Failed to start video upload analysis');
          setLoading(false);
        }
      } else {
        const res = await startAnalysis({ videoPath: selectedVideo, roadId, cameraId });
        if (res.success) {
          setActiveJob(res.data);
        } else {
          setError(res.message || 'Failed to start analysis');
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error connecting to backend server');
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (activeJob?.resultSummary) {
      navigator.clipboard.writeText(JSON.stringify(activeJob.resultSummary, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const summary = activeJob?.resultSummary;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Video Analysis Console</h2>
          <p className="page-subtitle">
            Upload recorded CCTV footage or select a registered road camera stream to execute vehicle detection, ByteTrack tracking, virtual line counting, speed estimation, and congestion modeling.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Control Panel */}
        <div className="glass-panel">
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={16} color="var(--brand-accent)" />
            <span>Analysis Parameters</span>
          </h3>

          {/* Video Source Selection */}
          <div className="form-group">
            <label className="form-label">Preloaded CCTV Streams</label>
            <select
              className="form-select"
              value={selectedVideo}
              onChange={(e) => { 
                setSelectedVideo(e.target.value); 
                setUploadFile(null); 
              }}
              disabled={loading}
            >
              {PRELOADED_VIDEOS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: '700', textTransform: 'uppercase' }}>or upload file</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Upload Dropzone */}
          <div className="form-group">
            <label className="form-label">Upload Video Footage</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/avi,video/quicktime,video/x-matroska"
              style={{ display: 'none' }}
              disabled={loading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setUploadFile(e.target.files[0]);
                }
              }}
            />

            {!uploadFile ? (
              <div 
                className="upload-dropzone"
                onClick={() => !loading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
              >
                <Upload size={24} color="var(--brand-accent)" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.825rem' }}>
                  Click to select video
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Supported: MP4, AVI, MOV, MKV (Up to 500 MB)
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileVideo size={18} color="var(--brand-accent)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {uploadFile.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    disabled={loading}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Road and Camera Identifiers */}
          <div className="form-group">
            <label className="form-label">Road Corridor ID</label>
            <input
              type="text"
              className="form-input"
              value={roadId}
              onChange={(e) => setRoadId(e.target.value)}
              disabled={loading}
              placeholder="e.g. ROAD001"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fixed Camera ID</label>
            <input
              type="text"
              className="form-input"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              disabled={loading}
              placeholder="e.g. CAM001"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {loading ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : <Play size={16} />}
            <span>{loading ? 'Processing Video Pipeline...' : 'Execute Traffic Analysis'}</span>
          </button>

          {/* Error Banner */}
          {error && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--status-severe-bg)', border: '1px solid var(--status-severe-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-severe-text)', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Request Error</strong>
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Execution & Results Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Job Progress Console */}
          {activeJob && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  JOB ID: <strong style={{ color: 'var(--text-primary)' }}>{activeJob.jobId}</strong>
                </span>
                {activeJob.status === 'completed' && (
                  <span style={{ color: 'var(--status-low-text)', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle2 size={15} /> Analysis Finished
                  </span>
                )}
              </div>

              <JobProgressBar 
                progress={activeJob.progress || 0} 
                status={activeJob.status} 
                stageMessage={activeJob.stageMessage} 
                currentFrame={activeJob.currentFrame}
                totalFrames={activeJob.totalFrames}
              />

              {activeJob.status === 'failed' && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--status-severe-bg)', border: '1px solid var(--status-severe-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-severe-text)', fontSize: '0.825rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.2rem' }}>Computer Vision Pipeline Interrupted:</div>
                  <div>{activeJob.errorMessage || 'Unknown error occurred while processing video frames.'}</div>
                  <button 
                    onClick={handleStartAnalysis}
                    className="btn-secondary" 
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  >
                    <RotateCcw size={12} /> Retry Analysis
                  </button>
                </div>
              )}

              {/* Completed Metrics Summary Strip */}
              {activeJob.status === 'completed' && summary && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <div className="metric-label" title="Total unique vehicle tracks detected across the road corridor">Corridor Monitored</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--brand-accent)', fontFamily: 'var(--font-mono)' }}>
                        {summary.vehicles?.corridorMonitored?.total ?? summary.vehicles?.uniqueMonitoredTotal ?? summary.vehicles?.total}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Unique in scene</div>
                    </div>
                    <div>
                      <div className="metric-label" title="Vehicles that crossed the virtual counting line">Line Crossings</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--brand-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {summary.vehicles?.lineCrossings?.total ?? summary.vehicles?.total}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cordon flow count</div>
                    </div>
                    <div>
                      <div className="metric-label">Avg Speed</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-low-text)', fontFamily: 'var(--font-mono)' }}>
                        {summary.traffic?.averageSpeedKmh} <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>km/h</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Calibrated velocity</div>
                    </div>
                    <div>
                      <div className="metric-label">Hourly Flow</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-mod-text)', fontFamily: 'var(--font-mono)' }}>
                        {summary.traffic?.averageFlowVehiclesPerHour} <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>veh/h</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Throughput rate</div>
                    </div>
                    <div>
                      <div className="metric-label">Congestion & Queue</div>
                      <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <StatusBadge level={summary.traffic?.congestionLevel} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          ({summary.vehicles?.stationaryVehiclesCount ?? summary.traffic?.stationaryCount ?? 0} stopped)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Density: {summary.traffic?.densityLevel || 'LOW'}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Class Breakdown Tag Pill Strip */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vehicle Breakdown:</span>
                    <span style={{ color: '#38bdf8' }}>Cars: <strong>{summary.vehicles?.corridorMonitored?.cars ?? summary.vehicles?.cars ?? 0}</strong></span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span style={{ color: '#a78bfa' }}>Motorcycles: <strong>{summary.vehicles?.corridorMonitored?.motorcycles ?? summary.vehicles?.motorcycles ?? 0}</strong></span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span style={{ color: '#fbbf24' }}>Buses: <strong>{summary.vehicles?.corridorMonitored?.buses ?? summary.vehicles?.buses ?? 0}</strong></span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span style={{ color: '#f87171' }}>Trucks: <strong>{summary.vehicles?.corridorMonitored?.trucks ?? summary.vehicles?.trucks ?? 0}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Output Display Panel: Video Player & JSON Inspector */}
          <div className="glass-panel" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={activeTab === 'video' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setActiveTab('video')}
                >
                  <Video size={14} /> Processed Output Video
                </button>
                <button
                  type="button"
                  className={activeTab === 'json' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setActiveTab('json')}
                >
                  <FileText size={14} /> Telemetry Summary JSON
                </button>
              </div>

              {activeTab === 'json' && summary && (
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  {copied ? <Check size={13} color="var(--status-low-text)" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}

              {activeTab === 'video' && summary?.outputs?.processedVideoFilename && (
                <a
                  href={`/outputs/${summary.outputs.processedVideoFilename}`}
                  download={summary.outputs.processedVideoFilename}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none' }}
                >
                  <Download size={13} />
                  <span>Download MP4</span>
                </a>
              )}
            </div>

            {activeTab === 'video' ? (
              <div className="video-box">
                <video
                  key={summary?.outputs?.processedVideoFilename || 'default-view'}
                  className="video-element"
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  src={summary?.outputs?.processedVideoFilename ? `/outputs/${summary.outputs.processedVideoFilename}` : '/outputs/traffic_road_01_processed.mp4'}
                  onError={(e) => {
                    // Safe graceful fallback to sample raw video if processed file is being written
                    if (!e.target.src.endsWith('/videos/traffic_road_01.mp4')) {
                      e.target.src = '/videos/traffic_road_01.mp4';
                    }
                  }}
                />
              </div>
            ) : (
              <pre className="json-viewer" tabIndex={0}>
                {summary ? JSON.stringify(summary, null, 2) : '// Complete computer vision telemetry summary will appear here once video analysis finishes.'}
              </pre>
            )}

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              <span>Annotated overlays: Bounding boxes, ByteTrack IDs, counting line vector, calibrated speed HUD</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>H.264 Web Stream</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VideoAnalysis;
