import React, { useState, useEffect } from 'react';
import { Car, Zap, Activity, Gauge, AlertTriangle, RefreshCw, Play, BarChart3, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, LabelList } from 'recharts';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { useTheme } from '../context/ThemeContext';
import { getLatestReading, getTrafficSummary, getTrafficReadings, getAnalysisJobs } from '../services/api';

const VEHICLE_COLORS_LIGHT = {
  cars: '#16784A',        // Government Emerald
  motorcycles: '#398A80', // Muted Teal
  buses: '#E9A23B',       // Government Saffron
  trucks: '#C2410C'       // Warm Terracotta / Rust
};

const VEHICLE_COLORS_DARK = {
  cars: '#7BD69C',        // Fresh Emerald
  motorcycles: '#86C8B9', // Teal Accent
  buses: '#F1C36C',       // Saffron Accent
  trucks: '#F6995C'       // Warm Orange Accent
};

const Dashboard = () => {
  const { theme } = useTheme();
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [videoSrc, setVideoSrc] = useState('/outputs/traffic_road_01_processed.mp4');

  const vehicleColors = theme === 'dark' ? VEHICLE_COLORS_DARK : VEHICLE_COLORS_LIGHT;

  const fetchData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [sumRes, jobsRes] = await Promise.all([
        getTrafficSummary({ roadId: 'ROAD001' }).catch(() => ({ success: false })),
        getAnalysisJobs().catch(() => ({ data: [] }))
      ]);

      if (sumRes.success) setSummary(sumRes.data);

      const activeJobId = sumRes.success && sumRes.data?.jobId ? sumRes.data.jobId : undefined;

      const [latestRes, readRes] = await Promise.all([
        getLatestReading({ roadId: 'ROAD001', jobId: activeJobId }).catch(() => ({ data: null })),
        getTrafficReadings({ roadId: 'ROAD001', jobId: activeJobId, limit: 20 }).catch(() => ({ success: false, data: [] }))
      ]);

      if (latestRes.data) setLatest(latestRes.data);
      if (readRes.success && readRes.data && readRes.data.length > 0) {
        setReadings(readRes.data);
      } else if (activeJobId) {
        const fallbackRead = await getTrafficReadings({ roadId: 'ROAD001', limit: 20 }).catch(() => ({ success: false, data: [] }));
        if (fallbackRead.success) setReadings(fallbackRead.data);
      }

      if (jobsRes?.data && jobsRes.data.length > 0) {
        const completed = jobsRes.data.find(j => j.status === 'completed' && (j.resultSummary?.outputs?.processedVideoFilename || j.processedVideoPath));
        if (completed) {
          const fname = completed.resultSummary?.outputs?.processedVideoFilename || completed.processedVideoPath?.split(/[\/\\]/).pop();
          if (fname) setVideoSrc(`/outputs/${fname}`);
        }
      }

    } catch (err) {
      setError('Unable to fetch live traffic metrics. Ensure backend server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const vehicleDistribution = summary ? [
    { name: 'Cars', count: (summary.corridorCounts?.cars ?? summary.vehicleCounts?.cars ?? 0), color: vehicleColors.cars },
    { name: 'Motorcycles', count: (summary.corridorCounts?.motorcycles ?? summary.vehicleCounts?.motorcycles ?? 0), color: vehicleColors.motorcycles },
    { name: 'Buses', count: (summary.corridorCounts?.buses ?? summary.vehicleCounts?.buses ?? 0), color: vehicleColors.buses },
    { name: 'Trucks', count: (summary.corridorCounts?.trucks ?? summary.vehicleCounts?.trucks ?? 0), color: vehicleColors.trucks }
  ] : [];

  const chartData = readings.map((r, idx) => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `T${idx+1}`,
    vehicles: r.vehicleCounts?.total || 0,
    speed: r.averageSpeedKmh || 0,
    flow: r.trafficFlowVehiclesPerHour || 0
  }));

  if (loading) {
    return (
      <div className="loading-box" role="status">
        <div className="spinner" aria-hidden="true"></div>
        <p>Loading Corridor Telemetry & Dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Corridor Traffic Monitor</h2>
          <p className="page-subtitle">
            Automated computer vision metrics, vehicle classification, calibrated flow rates, and density monitoring for Road Corridor ROAD001.
          </p>
        </div>
        <button 
          onClick={() => fetchData(true)} 
          disabled={refreshing} 
          className="btn-secondary"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Updating...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--status-severe-bg)', border: '1px solid var(--status-severe-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-severe-text)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Operational Metric Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Corridor Monitored"
          value={summary?.corridorVehicles ?? summary?.totalVehicles ?? 0}
          subtext={`Line Crossings: ${summary?.totalVehicles ?? 0}`}
          icon={Car}
          color="var(--brand-primary)"
        />
        <MetricCard
          title="Average Speed"
          value={`${summary?.averageSpeedKmh ?? 0} km/h`}
          subtext="Calibrated road velocity"
          icon={Gauge}
          color="var(--brand-teal)"
        />
        <MetricCard
          title="Traffic Flow Rate"
          value={`${summary?.averageFlowVehiclesPerHour ?? 0}`}
          subtext={`Queue in ROI: ${summary?.activeInRoi ?? 0} veh`}
          icon={Zap}
          color="var(--brand-saffron)"
        />
        <div className="glass-panel metric-card">
          <div className="metric-icon" style={{ color: 'var(--brand-teal)', backgroundColor: 'var(--bg-surface-mint)', border: '1px solid var(--border-medium)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div className="metric-label">Density & Congestion</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', alignItems: 'center' }}>
              <StatusBadge level={summary?.currentDensity || 'LOW'} type="density" />
              <StatusBadge level={summary?.currentCongestion || 'LOW'} type="congestion" />
            </div>
            <div className="metric-subtext">
              {summary?.stationaryVehicles ? `${summary.stationaryVehicles} stopped / queued` : 'Automated classification'}
            </div>
          </div>
        </div>
      </div>

      {/* Video Stream + Trend Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Annotated Processed Video Box */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Play size={15} color="var(--brand-primary)" />
              <span>Camera Stream & Overlays</span>
            </h3>
            {latest && (
              <span style={{ fontSize: '0.725rem', color: 'var(--status-low-text)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                FEED ACTIVE
              </span>
            )}
          </div>

          <div className="video-box">
            <video
              key={videoSrc}
              className="video-element"
              controls
              autoPlay
              muted
              loop
              playsInline
              src={videoSrc}
              onError={(e) => {
                if (!e.target.src.endsWith('/videos/traffic_road_01.mp4')) {
                  e.target.src = '/videos/traffic_road_01.mp4';
                }
              }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.65rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Virtual line crossing, ByteTrack IDs, & calibrated speed HUD</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Fixed Camera CAM001</span>
          </div>
        </div>

        {/* Traffic Flow & Speed Trend Chart */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <TrendingUp size={15} color="var(--brand-primary)" />
            <span>Traffic Readings Over Time</span>
          </h3>

          {chartData.length === 0 ? (
            <div className="empty-box" style={{ flex: 1 }}>
              <p>No historical traffic readings recorded yet. Execute an analysis job to generate time-series metrics.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-surface-elevated)', 
                      borderColor: 'var(--border-medium)', 
                      borderRadius: '6px', 
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                  />
                  <Line type="monotone" dataKey="vehicles" name="Vehicles Counted" stroke={vehicleColors.cars} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="speed" name="Avg Speed (km/h)" stroke={vehicleColors.motorcycles} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="flow" name="Flow Rate (veh/hr)" stroke={vehicleColors.buses} strokeWidth={2} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Category Distribution Bar Chart */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BarChart3 size={15} color="var(--brand-primary)" />
          <span>Vehicle Classification Breakdown ({summary?.corridorVehicles ?? summary?.totalVehicles ?? 0} Monitored Corridor Vehicles)</span>
        </h3>
        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vehicleDistribution} margin={{ top: 25, right: 15, left: -15, bottom: 5 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                stroke="var(--text-subtle)" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} 
                tickLine={false} 
              />
              <YAxis 
                stroke="var(--text-subtle)" 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                tickLine={false} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-surface-elevated)', 
                  borderColor: 'var(--border-medium)', 
                  borderRadius: '6px',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
                itemStyle={{ color: 'var(--brand-primary)', fontWeight: 600 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                <LabelList 
                  dataKey="count" 
                  position="top" 
                  fill="var(--text-primary)" 
                  fontSize={12} 
                  fontWeight={700} 
                  offset={6} 
                />
                {vehicleDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
