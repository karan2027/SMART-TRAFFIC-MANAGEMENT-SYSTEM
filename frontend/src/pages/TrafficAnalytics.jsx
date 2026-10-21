import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Gauge, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from 'recharts';
import { getTrafficReadings } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const TrafficAnalytics = () => {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadings = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const res = await getTrafficReadings({ limit: 100 });
      if (res.success && res.data) {
        setReadings(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics readings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReadings();
  }, []);

  const timeSeriesData = readings.map((r, i) => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Frame ${i*10}`,
    cars: r.vehicleCounts?.cars || 0,
    bikes: r.vehicleCounts?.motorcycles || 0,
    buses: r.vehicleCounts?.buses || 0,
    trucks: r.vehicleCounts?.trucks || 0,
    speed: r.averageSpeedKmh || 0,
    flow: r.trafficFlowVehiclesPerHour || 0,
    congestion: r.congestionLevel || 'LOW'
  }));

  if (loading) {
    return (
      <div className="loading-box" role="status">
        <div className="spinner" aria-hidden="true"></div>
        <p>Loading Historical Traffic Analytics...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Corridor Traffic Analytics</h2>
          <p className="page-subtitle">
            Historical time-series telemetry of vehicle classifications, speed trends, volume flow rates, and density indicators.
          </p>
        </div>
        <button 
          onClick={() => fetchReadings(true)} 
          disabled={refreshing}
          className="btn-secondary"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Updating...' : 'Refresh Records'}</span>
        </button>
      </div>

      {readings.length === 0 ? (
        <div className="glass-panel empty-box">
          <AlertTriangle size={32} color="var(--status-mod-text)" />
          <p>No historical traffic readings recorded in database yet. Run an analysis on a video to populate telemetry.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Stacked Classification Area Chart */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <TrendingUp size={15} color="var(--brand-accent)" />
              <span>Vehicle Classification Distribution Over Time</span>
            </h3>
            <div style={{ height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-surface-elevated)', 
                      borderColor: 'var(--border-medium)', 
                      borderRadius: '6px',
                      fontSize: '12px' 
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }} />
                  <Area type="monotone" dataKey="cars" name="Cars" stackId="1" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="bikes" name="Motorcycles" stackId="1" stroke="#c084fc" fill="#c084fc" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="buses" name="Buses" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="trucks" name="Trucks" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Speed & Hourly Flow Rate Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Gauge size={15} color="var(--status-low-text)" />
                <span>Calibrated Average Speed (km/h)</span>
              </h3>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <XAxis dataKey="time" stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-surface-elevated)', 
                        borderColor: 'var(--border-medium)', 
                        borderRadius: '6px',
                        fontSize: '12px' 
                      }} 
                    />
                    <Bar dataKey="speed" name="Speed (km/h)" fill="var(--status-low-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Zap size={15} color="var(--status-mod-text)" />
                <span>Calculated Volume Flow Rate (veh/h)</span>
              </h3>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <XAxis dataKey="time" stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-subtle)" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-surface-elevated)', 
                        borderColor: 'var(--border-medium)', 
                        borderRadius: '6px',
                        fontSize: '12px' 
                      }} 
                    />
                    <Bar dataKey="flow" name="Flow (veh/h)" fill="var(--status-mod-text)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Historical Readings Log Table */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              Aggregated Window Readings Log ({readings.length})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Corridor / Camera</th>
                    <th>Total Count</th>
                    <th>Class Breakdown</th>
                    <th>Speed (km/h)</th>
                    <th>Flow (veh/h)</th>
                    <th>Congestion</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(-15).reverse().map((r, i) => (
                    <tr key={r._id || i}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {r.timestamp ? new Date(r.timestamp).toLocaleString() : `T${i}`}
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{r.roadId}</span>
                        <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-subtle)' }}>{r.cameraId}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                        {r.vehicleCounts?.total || 0}
                      </td>
                      <td style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        C:{r.vehicleCounts?.cars || 0} | M:{r.vehicleCounts?.motorcycles || 0} | B:{r.vehicleCounts?.buses || 0} | T:{r.vehicleCounts?.trucks || 0}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {r.averageSpeedKmh || 0}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {r.trafficFlowVehiclesPerHour || 0}
                      </td>
                      <td>
                        <StatusBadge level={r.congestionLevel || 'LOW'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default TrafficAnalytics;
