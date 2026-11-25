import React, { useState, useEffect } from 'react';
import { getJunctionById, triggerEmergencyOverride, clearEmergencyOverride } from '../services/api';
import { Siren, Shield, CheckCircle, AlertTriangle, RefreshCw, Radio, PlayCircle, StopCircle } from 'lucide-react';

const EmergencyMonitoring = () => {
  const [junction, setJunction] = useState(null);
  const [selectedApproach, setSelectedApproach] = useState('SOUTH');
  const [vehicleType, setVehicleType] = useState('AMBULANCE');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    fetchJunction();
    const interval = setInterval(fetchJunction, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchJunction = async () => {
    try {
      const res = await getJunctionById('JUNC001');
      if (res.success) setJunction(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    try {
      const res = await triggerEmergencyOverride('JUNC001', {
        approach: selectedApproach,
        vehicleType,
        triggeredBy: 'OPERATOR_OVERRIDE'
      });
      if (res.success) {
        setActionMessage(res.message);
        fetchJunction();
      }
    } catch (err) {
      alert(`Trigger failed: ${err.message}`);
    }
  };

  const handleClear = async () => {
    try {
      const res = await clearEmergencyOverride('JUNC001');
      if (res.success) {
        setActionMessage(res.message);
        fetchJunction();
      }
    } catch (err) {
      alert(`Clear failed: ${err.message}`);
    }
  };

  const isEmergencyActive = junction?.emergencyOverride?.isActive;

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Siren className="text-red-500 animate-pulse" /> Emergency Vehicle Pre-emption & Priority Control
          </h2>
          <p className="text-sm text-secondary">
            Multi-spectral strobe & siren detection and automated safe green-corridor actuation with clearance interlocks.
          </p>
        </div>
        <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchJunction}>
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      {/* Emergency Status Banner */}
      <div className={`card p-6 mb-8 border-2 ${
        isEmergencyActive ? 'border-red-500 bg-red-500/10' : 'border-emerald-500 bg-emerald-500/10'
      }`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${isEmergencyActive ? 'bg-red-600 text-white animate-bounce' : 'bg-emerald-600 text-white'}`}>
              <Siren size={32} />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-widest block text-muted">
                System Operating State
              </span>
              <h3 className="text-2xl font-extrabold text-primary">
                {isEmergencyActive ? `EMERGENCY PRE-EMPTION ACTIVE (${junction.emergencyOverride.approach} APPROACH)` : 'NORMAL ADAPTIVE SIGNAL CONTROL'}
              </h3>
              <p className="text-xs text-secondary mt-1">
                {isEmergencyActive
                  ? `Corridor cleared for ${junction.emergencyOverride.vehicleType}. All conflicting directions held on RED.`
                  : 'Webster traffic optimization running across all 4 intersection approaches.'}
              </p>
            </div>
          </div>

          {isEmergencyActive && (
            <button className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2 text-sm font-bold px-5 py-3" onClick={handleClear}>
              <StopCircle size={18} /> Clear Override & Resume Adaptive
            </button>
          )}
        </div>
      </div>

      {/* Manual Dispatch & Testing Trigger Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="font-bold text-base mb-4">Manual Priority Override Dispatch</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Target Approach Corridor</label>
              <select
                className="input-select w-full"
                value={selectedApproach}
                onChange={(e) => setSelectedApproach(e.target.value)}
              >
                <option value="NORTH">NORTH Approach (Grand Trunk Express)</option>
                <option value="SOUTH">SOUTH Approach (Commercial Corridor)</option>
                <option value="EAST">EAST Approach (Ring Link)</option>
                <option value="WEST">WEST Approach (Downtown Transit)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted block mb-1">Emergency Vehicle Category</label>
              <select
                className="input-select w-full"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                <option value="AMBULANCE">Ambulance (Medical Response)</option>
                <option value="FIRE_TRUCK">Fire Brigade Truck</option>
                <option value="POLICE">Police Interceptor Unit</option>
                <option value="ORGAN_TRANSPORT">Organ Transplant Courier</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                className="btn-danger w-full py-2.5 font-bold flex items-center justify-center gap-2"
                onClick={handleTrigger}
              >
                <PlayCircle size={16} /> Actuate Emergency Green Corridor
              </button>
            </div>
          </div>
        </div>

        {/* 4-Way Signal Lights Status Grid */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-base mb-4">Live 4-Way Approach Signal Actuation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {junction?.approaches?.map((app) => {
              const isGreen = app.signalState === 'GREEN';
              const isYellow = app.signalState === 'YELLOW';
              const isRed = app.signalState === 'RED';
              return (
                <div key={app.direction} className="bg-canvas-subtle p-4 rounded-xl border border-subtle flex flex-col items-center">
                  <span className="font-bold text-sm mb-2">{app.direction}</span>

                  {/* Traffic Light Head */}
                  <div className="w-12 py-3 bg-black rounded-full flex flex-col items-center gap-2 shadow-inner border border-white/10 my-2">
                    <div className={`w-7 h-7 rounded-full ${isRed ? 'bg-red-500 shadow-[0_0_12px_#ef4444]' : 'bg-red-950 opacity-40'}`} />
                    <div className={`w-7 h-7 rounded-full ${isYellow ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b]' : 'bg-amber-950 opacity-40'}`} />
                    <div className={`w-7 h-7 rounded-full ${isGreen ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]' : 'bg-emerald-950 opacity-40'}`} />
                  </div>

                  <span className={`text-xs font-bold mt-2 ${
                    isGreen ? 'text-emerald-500' : isYellow ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {app.signalState} ({app.remainingSeconds}s)
                  </span>
                  <span className="text-[11px] text-muted mt-1">{app.queueCount} queuing vehicles</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-surface-mint border border-medium rounded-lg text-sm text-primary flex items-center gap-2">
          <CheckCircle size={18} className="text-brand" /> {actionMessage}
        </div>
      )}
    </div>
  );
};

export default EmergencyMonitoring;
