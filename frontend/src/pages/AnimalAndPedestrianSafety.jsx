import React, { useState, useEffect } from 'react';
import { getHazards, reportHazard, resolveHazard, getJunctionById, updatePedestrianSafety } from '../services/api';
import { UserCheck, AlertTriangle, ShieldCheck, CheckCircle, RefreshCw, Radio, PlayCircle, StopCircle, ArrowRight } from 'lucide-react';

const AnimalAndPedestrianSafety = () => {
  const [hazards, setHazards] = useState([]);
  const [junction, setJunction] = useState(null);
  const [pedestrianWaitingCount, setPedestrianWaitingCount] = useState(3);
  const [crosswalkActive, setCrosswalkActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [hRes, jRes] = await Promise.all([
        getHazards(),
        getJunctionById('JUNC001')
      ]);
      if (hRes.success) setHazards(hRes.data);
      if (jRes.success) {
        setJunction(jRes.data);
        setCrosswalkActive(jRes.data.pedestrianSafety?.crosswalkOccupied || false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCattle = async (state) => {
    try {
      await reportHazard({
        junctionId: 'JUNC001',
        roadId: 'ROAD_S01',
        approach: 'SOUTH',
        animalClass: 'COW',
        confidence: 0.94,
        consecutiveFramesObserved: 14,
        hazardState: state
      });
      fetchData();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  const handleResolveHazard = async (hazardId) => {
    try {
      await resolveHazard(hazardId, {
        squadNotes: 'Municipal Cattle Catching Squad safely guided cattle off carriageway.'
      });
      fetchData();
    } catch (err) {
      alert(`Resolve failed: ${err.message}`);
    }
  };

  const handleTogglePedestrian = async () => {
    try {
      const nextOccupied = !crosswalkActive;
      setCrosswalkActive(nextOccupied);
      await updatePedestrianSafety('JUNC001', {
        approach: 'NORTH',
        crosswalkOccupied: nextOccupied,
        waitingPedestrians: nextOccupied ? pedestrianWaitingCount : 0,
        extendSeconds: nextOccupied ? 8 : 0
      });
      fetchData();
    } catch (err) {
      alert(`Pedestrian update error: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="text-brand" /> Stray Animal & Pedestrian Safety Protection
          </h2>
          <p className="text-sm text-secondary">
            Stage 3 Indian Road context: Stray cattle metric isolation, Flashing Amber caution timeouts, and crosswalk pedestrian walk-phase extensions.
          </p>
        </div>
        <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Section 1: Stray Animal & Cattle Hazard Management */}
        <div className="card p-6 border-2 border-amber-300 dark:border-amber-900/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="badge badge-amber text-xs uppercase mb-1 block w-fit">
                Indian Context Calibration
              </span>
              <h3 className="font-bold text-xl text-primary">Stray Cattle Hazard Control</h3>
              <p className="text-xs text-muted mt-0.5">
                Excludes cattle from vehicle queue math to prevent green-time distortion.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs"
                onClick={() => handleSimulateCattle('MOVING_CROSSING')}
              >
                + Moving Cattle
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => handleSimulateCattle('STATIONARY_OBSTRUCTION')}
              >
                + Sitting Cattle
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            {hazards.map((h) => {
              const isStationary = h.hazardState === 'STATIONARY_OBSTRUCTION';
              return (
                <div key={h.hazardId} className="p-4 bg-canvas-subtle rounded-lg border border-subtle">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-primary">
                      🐄 {h.animalClass} ({h.hazardState})
                    </span>
                    <span className={`badge text-xs ${isStationary ? 'badge-amber' : 'badge-red'}`}>
                      {h.signalMitigation}
                    </span>
                  </div>
                  <div className="text-xs text-muted mb-3">
                    Approach {h.approach} on {h.junctionId} • {(h.confidence * 100).toFixed(0)}% Confidence • {h.consecutiveFramesObserved} Frames Observed
                  </div>

                  <div className="flex justify-between items-center border-t border-subtle pt-2 text-xs">
                    <span className="text-muted">
                      {isStationary
                        ? '🟡 Flashing Amber active (Proceed with Caution). Signal not deadlocked.'
                        : '🔴 All-Red caution pause active.'}
                    </span>
                    <button
                      className="btn-primary text-xs py-1 px-3"
                      onClick={() => handleResolveHazard(h.hazardId)}
                    >
                      Clear & Resolve
                    </button>
                  </div>
                </div>
              );
            })}

            {hazards.length === 0 && (
              <div className="p-8 text-center text-xs text-muted bg-canvas-subtle rounded-lg">
                No active livestock on carriageway. Signal running unhindered.
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Vulnerable Pedestrian Crosswalk Protection */}
        <div className="card p-6 border-2 border-emerald-300 dark:border-emerald-900/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="badge badge-emerald text-xs uppercase mb-1 block w-fit">
                Vulnerable Road Users
              </span>
              <h3 className="font-bold text-xl text-primary">Crosswalk ROI & Walk Extension</h3>
              <p className="text-xs text-muted mt-0.5">
                YOLOv8 Class 0 detection inside zebra crossing polygon.
              </p>
            </div>
            <button
              className={`btn text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 ${
                crosswalkActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              onClick={handleTogglePedestrian}
            >
              {crosswalkActive ? 'Release Crosswalk' : 'Simulate Pedestrians in Crosswalk'}
            </button>
          </div>

          <div className="p-4 bg-canvas-subtle rounded-lg border border-subtle mb-4">
            <div className="grid grid-cols-2 gap-4 text-xs mb-3">
              <div>
                <span className="text-muted block">Crosswalk Status</span>
                <span className={`text-base font-bold ${crosswalkActive ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {crosswalkActive ? '🚶 PEDESTRIANS OCCUPYING CROSSWALK' : 'CLEAR'}
                </span>
              </div>
              <div>
                <span className="text-muted block">Dynamic Walk Extension</span>
                <span className="text-base font-bold text-primary font-mono">
                  {crosswalkActive ? '+8.0s All-Red Clearance' : '0.0s (Normal Cycle)'}
                </span>
              </div>
            </div>

            <div className="info-row text-xs border-t border-subtle pt-2">
              <span className="text-muted">Turning-Conflict Suppression:</span>
              <span className={`font-bold ${crosswalkActive ? 'text-red-500' : 'text-emerald-500'}`}>
                {crosswalkActive ? 'HELD ON RED (Free-Left Blocked)' : 'PERMITTED'}
              </span>
            </div>
          </div>

          <div className="text-xs text-muted leading-relaxed">
            <strong>FSM Safety Invariant:</strong> When elderly pedestrians or groups remain inside the crosswalk ROI polygon as walk time approaches zero, the Finite State Machine automatically suppresses vehicular green signals for +5 to 10 seconds.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimalAndPedestrianSafety;
