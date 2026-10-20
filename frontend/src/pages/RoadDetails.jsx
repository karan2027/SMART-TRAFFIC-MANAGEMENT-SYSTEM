import React, { useState, useEffect } from 'react';
import { MapPin, Camera as CameraIcon, Layers, Video, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { getRoads, getCameras, getLatestReading } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const RoadDetails = () => {
  const [roads, setRoads] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInfrastructure = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [rRes, cRes] = await Promise.all([getRoads(), getCameras()]);
      if (rRes.success && rRes.data.length > 0) {
        setRoads(rRes.data);
        if (!selectedRoad) setSelectedRoad(rRes.data[0]);
      }
      if (cRes.success) {
        setCameras(cRes.data);
      }
    } catch (err) {
      console.error('Failed to load infrastructure:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInfrastructure();
  }, []);

  useEffect(() => {
    if (selectedRoad) {
      getLatestReading({ roadId: selectedRoad.roadId })
        .then(res => setLatestReading(res.data))
        .catch(() => setLatestReading(null));
    }
  }, [selectedRoad]);

  if (loading) {
    return (
      <div className="loading-box" role="status">
        <div className="spinner" aria-hidden="true"></div>
        <p>Loading Corridor Infrastructure Registry...</p>
      </div>
    );
  }

  const assignedCameras = cameras.filter(c => c.roadId === selectedRoad?.roadId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Corridor Infrastructure Registry</h2>
          <p className="page-subtitle">
            Registered road segments, physical lane configurations, and associated CCTV monitoring cameras.
          </p>
        </div>
        <button 
          onClick={() => loadInfrastructure(true)}
          disabled={refreshing}
          className="btn-secondary"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Updating...' : 'Refresh Registry'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Corridor Selector List */}
        <div className="glass-panel">
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <MapPin size={15} color="var(--brand-accent)" />
            <span>Active Corridors ({roads.length})</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {roads.map(r => {
              const isSelected = selectedRoad?.roadId === r.roadId;
              return (
                <button
                  key={r.roadId}
                  onClick={() => setSelectedRoad(r)}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${isSelected ? 'rgba(2, 132, 199, 0.4)' : 'var(--border-subtle)'}`,
                    color: isSelected ? 'var(--brand-accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{r.name}</div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {r.roadId} • {r.lanes || 2} Lanes
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Road Details View */}
        {selectedRoad && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Corridor Overview */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedRoad.name}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{selectedRoad.description}</p>
                </div>
                <span className="status-badge low">OPERATIONAL</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div className="metric-label">Corridor Code</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--brand-accent)', marginTop: '0.2rem' }}>
                    {selectedRoad.roadId}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Traffic Lanes</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {selectedRoad.lanes || 4} Lanes
                  </div>
                </div>
                <div>
                  <div className="metric-label">Traffic Direction</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {selectedRoad.direction || 'Two-Way'}
                  </div>
                </div>
                <div>
                  <div className="metric-label">Speed Limit</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--status-low-text)', marginTop: '0.2rem' }}>
                    60 km/h
                  </div>
                </div>
              </div>
            </div>

            {/* Associated CCTV Cameras Table */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <CameraIcon size={15} color="var(--brand-accent)" />
                <span>Associated Monitoring Cameras ({assignedCameras.length})</span>
              </h3>

              {assignedCameras.length === 0 ? (
                <div className="empty-box" style={{ padding: '1.5rem' }}>
                  <p>No camera feeds currently assigned to this road corridor.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Camera ID</th>
                        <th>Device Name</th>
                        <th>Resolution</th>
                        <th>Target FPS</th>
                        <th>Status</th>
                        <th>Video Source File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedCameras.map(c => (
                        <tr key={c.cameraId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--brand-accent)' }}>
                            {c.cameraId}
                          </td>
                          <td style={{ fontWeight: '600' }}>{c.name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                            {c.resolution?.width || 1280}x{c.resolution?.height || 720}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                            {c.fps || 30} FPS
                          </td>
                          <td>
                            <span className="status-badge low">ONLINE</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {c.sourcePath || 'data/videos/traffic_road_01.mp4'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Current Real-Time Road Status */}
            {latestReading && (
              <div className="glass-panel">
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
                  Latest Sensor Snapshot (Camera {latestReading.cameraId})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div>
                    <div className="metric-label">Vehicles in Field</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--brand-accent)' }}>
                      {latestReading.vehicleCounts?.total}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Observed Speed</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--status-low-text)' }}>
                      {latestReading.averageSpeedKmh} km/h
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Calculated Flow</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--status-mod-text)' }}>
                      {latestReading.trafficFlowVehiclesPerHour} veh/h
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Congestion Status</div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <StatusBadge level={latestReading.congestionLevel} />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default RoadDetails;
