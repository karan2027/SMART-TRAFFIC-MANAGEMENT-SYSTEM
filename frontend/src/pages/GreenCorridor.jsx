import React, { useState, useEffect } from 'react';
import { getGreenCorridors, planGreenRoute, activateGreenCorridor, advanceGreenCorridor, getJunctions } from '../services/api';
import { Route, Play, CheckCircle, Clock, ShieldCheck, ChevronRight, Activity, ArrowRight, RefreshCw } from 'lucide-react';

const GreenCorridor = () => {
  const [corridors, setCorridors] = useState([]);
  const [junctions, setJunctions] = useState([]);
  const [startJunction, setStartJunction] = useState('JUNC001');
  const [destJunction, setDestJunction] = useState('JUNC002');
  const [emergencyType, setEmergencyType] = useState('AMBULANCE');
  const [plannedRoute, setPlannedRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, jRes] = await Promise.all([
        getGreenCorridors(),
        getJunctions()
      ]);
      if (cRes.success) setCorridors(cRes.data);
      if (jRes.success) setJunctions(jRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanRoute = async () => {
    try {
      const res = await planGreenRoute(startJunction, destJunction);
      if (res.success) setPlannedRoute(res.data);
    } catch (err) {
      alert(`Routing calculation error: ${err.message}`);
    }
  };

  const handleActivate = async () => {
    try {
      const res = await activateGreenCorridor({
        emergencyType,
        vehicleIdentifier: `EMG-${Math.floor(100 + Math.random() * 900)}`,
        startJunctionId: startJunction,
        destinationJunctionId: destJunction
      });
      if (res.success) {
        setPlannedRoute(null);
        fetchData();
      }
    } catch (err) {
      alert(`Activation failed: ${err.message}`);
    }
  };

  const handleAdvance = async (corridorId) => {
    try {
      const res = await advanceGreenCorridor(corridorId);
      if (res.success) {
        fetchData();
      }
    } catch (err) {
      alert(`Advance failed: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Route className="text-brand" /> Green Wave Corridor Management (NetworkX Graph)
          </h2>
          <p className="text-sm text-secondary">
            City-scale coordinated signal synchronization across multiple intersections along emergency response routes.
          </p>
        </div>
        <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Corridor Planner Card */}
      <div className="card p-6 mb-8">
        <h3 className="font-bold text-lg mb-4">Plan Emergency Corridor Route (Dijkstra Optimization)</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs font-bold text-muted block mb-1">Origin Junction</label>
            <select
              className="input-select w-full"
              value={startJunction}
              onChange={(e) => setStartJunction(e.target.value)}
            >
              <option value="JUNC001">JUNC001 (Grand Cross)</option>
              <option value="JUNC002">JUNC002 (Metro Hub)</option>
              <option value="JUNC003">JUNC003 (North Gate)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">Destination Junction</label>
            <select
              className="input-select w-full"
              value={destJunction}
              onChange={(e) => setDestJunction(e.target.value)}
            >
              <option value="JUNC002">JUNC002 (Metro Hub)</option>
              <option value="JUNC001">JUNC001 (Grand Cross)</option>
              <option value="JUNC004">JUNC004 (Interchange)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">Emergency Service</label>
            <select
              className="input-select w-full"
              value={emergencyType}
              onChange={(e) => setEmergencyType(e.target.value)}
            >
              <option value="AMBULANCE">Ambulance (Critical Patient)</option>
              <option value="ORGAN_TRANSPORT">Organ Transplant Courier</option>
              <option value="FIRE_BRIGADE">Fire Engine Response</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button className="btn-secondary flex-1 py-2 text-xs font-bold" onClick={handlePlanRoute}>
              Calculate Shortest Path
            </button>
            <button className="btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5" onClick={handleActivate}>
              <Play size={14} /> Activate Corridor
            </button>
          </div>
        </div>

        {/* Calculated Path preview */}
        {plannedRoute && (
          <div className="mt-6 p-4 bg-surface-mint rounded-lg border border-medium">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-sm text-primary">Optimal Coordinated Route:</span>
              <span className="text-xs font-mono font-bold text-emerald-600">
                Est. Travel Time: {plannedRoute.estimatedTravelTimeSeconds}s (Delay Saved: {plannedRoute.estimatedTimeSavedSeconds}s)
              </span>
            </div>
            <div className="flex items-center gap-3">
              {plannedRoute.routeJunctions.map((jId, idx) => (
                <React.Fragment key={jId}>
                  <div className="px-3 py-1.5 bg-surface rounded-md border border-subtle text-xs font-bold font-mono">
                    {jId}
                  </div>
                  {idx < plannedRoute.routeJunctions.length - 1 && (
                    <ArrowRight size={16} className="text-brand" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Corridors Progression */}
      <h3 className="font-bold text-lg mb-4">Active Green Corridors ({corridors.filter(c => c.status === 'ACTIVE').length})</h3>
      <div className="space-y-4">
        {corridors.map((c) => {
          const isActive = c.status === 'ACTIVE';
          return (
            <div key={c.corridorId} className={`card p-5 border-2 ${
              isActive ? 'border-brand bg-surface-mint/30' : 'border-subtle'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold">{c.corridorId}</span>
                    <span className={`badge text-xs ${isActive ? 'badge-amber animate-pulse' : 'badge-emerald'}`}>
                      {c.status}
                    </span>
                    <span className="badge badge-muted text-xs">{c.emergencyType}</span>
                  </div>
                  <h4 className="font-bold text-base text-primary">
                    {c.startJunctionId} <ArrowRight size={14} className="inline mx-1" /> {c.destinationJunctionId} ({c.vehicleIdentifier})
                  </h4>
                </div>

                {isActive && (
                  <button
                    className="btn-primary text-xs flex items-center gap-1.5"
                    onClick={() => handleAdvance(c.corridorId)}
                  >
                    Advance to Next Junction <ChevronRight size={14} />
                  </button>
                )}
              </div>

              {/* Step Sequence Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {c.routeJunctions.map((jId, idx) => {
                  const isCurrent = idx === c.currentJunctionIndex && isActive;
                  const isPast = idx < c.currentJunctionIndex || c.status === 'COMPLETED';
                  return (
                    <div
                      key={jId}
                      className={`p-3 rounded-lg border flex flex-col items-center ${
                        isCurrent
                          ? 'border-brand bg-brand text-white shadow-md'
                          : isPast
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-subtle bg-canvas-subtle text-muted'
                      }`}
                    >
                      <span className="font-bold text-xs">Step {idx + 1}: {jId}</span>
                      <span className="text-[11px] mt-1">
                        {isCurrent ? '🟢 PRE-EMPTION ACTIVE' : isPast ? '✅ CLEARED & RESTORED' : '⏳ AWAITING CONVOY'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {corridors.length === 0 && (
          <div className="card p-8 text-center text-muted text-xs">
            No active green wave corridors. Plan a route above to actuate priority waves.
          </div>
        )}
      </div>
    </div>
  );
};

export default GreenCorridor;
