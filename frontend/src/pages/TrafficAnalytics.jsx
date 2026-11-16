import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Gauge, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { getTrafficReadings } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const VEHICLE_COLORS_LIGHT = {
  cars: '#16784A',        // Government Emerald
  bikes: '#398A80',       // Muted Teal
  buses: '#E9A23B',       // Government Saffron
  trucks: '#C2410C'       // Warm Terracotta / Rust
};

const VEHICLE_COLORS_DARK = {
  cars: '#7BD69C',        // Fresh Emerald
  bikes: '#86C8B9',       // Teal Accent
  buses: '#F1C36C',       // Saffron Accent
  trucks: '#F6995C'       // Warm Orange Accent
};

const TrafficAnalytics = () => {
  const { theme } = useTheme();
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const vehicleColors = theme === 'dark' ? VEHICLE_COLORS_DARK : VEHICLE_COLORS_LIGHT;

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

  const timeSeriesData = readings.map((r, i) => {
    const counts = r.corridorCounts || r.vehicleCounts || {};
    return {
      time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Frame ${i*10}`,
      cars: counts.cars || 0,
      bikes: counts.motorcycles || 0,
      buses: counts.buses || 0,
      trucks: counts.trucks || 0,
      speed: r.averageSpeedKmh || 0,
      flow: r.trafficFlowVehiclesPerHour || 0,
      congestion: r.congestionLevel || 'LOW'
    };
  });

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
              <TrendingUp size={15} color="var(--brand-primary)" />
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
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-md)'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }} />
                  <Area type="monotone" dataKey="cars" name="Cars" stackId="1" stroke={vehicleColors.cars} fill={vehicleColors.cars} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="bikes" name="Motorcycles" stackId="1" stroke={vehicleColors.bikes} fill={vehicleColors.bikes} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="buses" name="Buses" stackId="1" stroke={vehicleColors.buses} fill={vehicleColors.buses} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="trucks" name="Trucks" stackId="1" stroke={vehicleColors.trucks} fill={vehicleColors.trucks} fillOpacity={0.35} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Speed & Hourly Flow Rate Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Gauge size={15} color="var(--brand-teal)" />
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
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        boxShadow: 'var(--shadow-md)'
                      }} 
                    />
                    <Bar dataKey="speed" name="Speed (km/h)" fill="var(--brand-teal)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel">
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Zap size={15} color="var(--brand-saffron)" />
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
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        boxShadow: 'var(--shadow-md)'
                      }} 
                    />
                    <Bar dataKey="flow" name="Flow (veh/h)" fill="var(--brand-saffron)" radius={[4, 4, 0, 0]} />
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
                  {readings.slice(-15).reverse().map((r, i) => {
                    const counts = r.corridorCounts || r.vehicleCounts || {};
                    return (
                      <tr key={r._id || i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {r.timestamp ? new Date(r.timestamp).toLocaleString() : `T${i}`}
                        </td>
                        <td>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{r.roadId}</span>
                          <span style={{ display: 'block', fontSize: '0.725rem', color: 'var(--text-subtle)' }}>{r.cameraId}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--brand-primary)' }}>
                          {counts.total || 0}
                        </td>
                        <td style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                          C:{counts.cars || 0} | M:{counts.motorcycles || 0} | B:{counts.buses || 0} | T:{counts.trucks || 0}
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
                    );
                  })}
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
