import React, { useState, useEffect } from 'react';
import { getAlerts, acknowledgeAlert, resolveAlert, createAlert } from '../services/api';
import { Bell, CheckCircle, ShieldAlert, AlertTriangle, RefreshCw, Filter, Volume2, XCircle } from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: 'badge-red',
  HIGH: 'badge-amber',
  MEDIUM: 'badge-emerald',
  INFO: 'badge-muted'
};

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 4000);
    return () => clearInterval(interval);
  }, [filterSeverity, filterStatus]);

  const fetchAlerts = async () => {
    try {
      const params = {};
      if (filterSeverity !== 'ALL') params.severity = filterSeverity;
      if (filterStatus !== 'ALL') params.status = filterStatus;
      const res = await getAlerts(params);
      if (res.success) setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgeAlert(alertId, 'Duty Officer');
      fetchAlerts();
    } catch (err) {
      alert(`Action error: ${err.message}`);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await resolveAlert(alertId);
      fetchAlerts();
    } catch (err) {
      alert(`Action error: ${err.message}`);
    }
  };

  const handleCreateTestAlert = async () => {
    try {
      await createAlert({
        type: 'CONGESTION',
        severity: 'HIGH',
        title: 'Downstream Queue Spillback Alert',
        message: 'Approach EAST backlog approaching 14 vehicles. Automatic green extension recommended.',
        junctionId: 'JUNC001',
        roadId: 'ROAD_E01'
      });
      fetchAlerts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="text-amber-500" /> Real-Time Live Alerts & Notifications Feed
          </h2>
          <p className="text-sm text-secondary">
            Server-Sent Events (SSE) streaming live congestion, accident emergencies, stray cattle obstructions, and violation events.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handleCreateTestAlert}>
            + Trigger Test Alert
          </button>
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchAlerts}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <span className="font-bold text-muted">Severity:</span>
            <select
              className="input-select text-xs py-1"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-muted">Status:</span>
            <select
              className="input-select text-xs py-1"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New (Unread)</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>

        <span className="badge badge-emerald text-xs">
          Live SSE Feed Connected
        </span>
      </div>

      {/* Alerts Feed List */}
      <div className="space-y-3">
        {alerts.map((alt) => {
          const isNew = alt.status === 'NEW';
          const isCritical = alt.severity === 'CRITICAL';
          return (
            <div
              key={alt.alertId}
              className={`card p-4 border-l-4 transition-all ${
                isCritical ? 'border-l-red-500 bg-red-50/20 dark:bg-red-950/10' : 'border-l-amber-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs font-bold uppercase ${SEVERITY_COLORS[alt.severity] || 'badge-muted'}`}>
                    {alt.severity}
                  </span>
                  <span className="badge badge-muted text-xs font-mono">
                    {alt.type}
                  </span>
                  <h4 className="font-bold text-base text-primary ml-1">{alt.title}</h4>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`badge text-[11px] ${
                    isNew ? 'badge-amber animate-pulse' : alt.status === 'ACKNOWLEDGED' ? 'badge-muted' : 'badge-emerald'
                  }`}>
                    {alt.status}
                  </span>
                  <span className="text-muted text-[11px]">
                    {new Date(alt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-secondary leading-relaxed mb-3">
                {alt.message}
              </p>

              <div className="flex justify-between items-center text-xs text-muted border-t border-subtle pt-2">
                <div className="flex items-center gap-3">
                  {alt.junctionId && <span>Junction: <strong>{alt.junctionId}</strong></span>}
                  {alt.roadId && <span>Road: <strong>{alt.roadId}</strong></span>}
                  {alt.acknowledgedBy && <span>Ack by: <strong>{alt.acknowledgedBy}</strong></span>}
                </div>

                <div className="flex gap-2">
                  {isNew && (
                    <button
                      className="btn-secondary text-xs py-1 px-3"
                      onClick={() => handleAcknowledge(alt.alertId)}
                    >
                      Acknowledge
                    </button>
                  )}
                  {alt.status !== 'RESOLVED' && (
                    <button
                      className="btn-primary text-xs py-1 px-3"
                      onClick={() => handleResolve(alt.alertId)}
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="card p-12 text-center text-muted text-xs">
            No alerts matching current filters. All road networks operating under normal conditions.
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
