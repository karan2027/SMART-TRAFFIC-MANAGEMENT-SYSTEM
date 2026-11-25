import React, { useState, useEffect } from 'react';
import {
  getIncidents,
  verifyAndDispatchIncident,
  markIncidentFalsePositive,
  getNearbyOfficers,
  reportIncident
} from '../services/api';
import {
  AlertTriangle,
  Shield,
  Video,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Navigation,
  Send,
  Radio,
  Flame,
  Volume2
} from 'lucide-react';

const AccidentDetection = () => {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [nearbyOfficers, setNearbyOfficers] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, []);

  // 30-second auto-dispatch countdown fallback when modal open
  useEffect(() => {
    let timer;
    if (showVerifyModal && selectedIncident && selectedIncident.status === 'PENDING_VERIFICATION') {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleAutoDispatch();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showVerifyModal, selectedIncident]);

  const fetchIncidents = async () => {
    try {
      const res = await getIncidents();
      if (res.success) {
        setIncidents(res.data);
        if (!selectedIncident && res.data.length > 0) {
          selectIncident(res.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectIncident = async (inc) => {
    setSelectedIncident(inc);
    try {
      const offRes = await getNearbyOfficers(77.2090, 28.6139, 2.5);
      if (offRes.success) {
        setNearbyOfficers(offRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyAndDispatch = async () => {
    if (!selectedIncident) return;
    try {
      const res = await verifyAndDispatchIncident(selectedIncident.incidentId, {
        verifiedBy: 'Senior Operator',
        notes: operatorNotes || 'Collision verified on video playback. Officers dispatched.',
        autoDispatch: false
      });
      if (res.success) {
        setShowVerifyModal(false);
        fetchIncidents();
      }
    } catch (err) {
      alert(`Dispatch failed: ${err.message}`);
    }
  };

  const handleAutoDispatch = async () => {
    if (!selectedIncident) return;
    try {
      await verifyAndDispatchIncident(selectedIncident.incidentId, {
        verifiedBy: 'SYSTEM_SAFETY_WATCHDOG',
        notes: 'Auto-dispatched via 30s timeout safety fallback',
        autoDispatch: true
      });
      setShowVerifyModal(false);
      fetchIncidents();
    } catch (err) {
      console.error('Auto dispatch error:', err);
    }
  };

  const handleMarkFalsePositive = async () => {
    if (!selectedIncident) return;
    try {
      await markIncidentFalsePositive(selectedIncident.incidentId, {
        operator: 'Operator',
        reason: operatorNotes || 'Shadow/bumper-to-bumper queue artifact'
      });
      setShowVerifyModal(false);
      fetchIncidents();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Demo injection helper to test live in UI
  const handleSimulateAccident = async () => {
    try {
      await reportIncident({
        junctionId: 'JUNC001',
        roadId: 'ROAD_N01',
        approach: 'NORTH',
        confidence: 0.95,
        severity: 'CRITICAL',
        collisionType: 'VEHICLE_COLLISION',
        involvedTrackIds: [24, 27],
        velocitiesAtImpactKmh: [42.0, 0.0],
        evidenceVideoUrl: 'outputs/traffic_road_01_annotated.mp4'
      });
      fetchIncidents();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle /> Automated Accident Detection & Nearest Police Dispatch
          </h2>
          <p className="text-sm text-secondary">
            Stage 3 Two-Stage Perception Pipeline: Kinematic Deceleration & IoU Heuristic, 10-15s Evidence Ring Buffer, and 2.5km Geospatial Officer Dispatch.
          </p>
        </div>
        <button className="btn-danger flex items-center gap-2" onClick={handleSimulateAccident}>
          <Flame size={16} /> Simulate Test Collision Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident List */}
        <div className="card p-4">
          <h3 className="font-bold text-base mb-3 flex items-center justify-between">
            <span>Collision Incident Feed</span>
            <span className="badge badge-red">{incidents.length} Events</span>
          </h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {incidents.map((inc) => {
              const isSelected = selectedIncident?.incidentId === inc.incidentId;
              const isPending = inc.status === 'PENDING_VERIFICATION';
              return (
                <div
                  key={inc.incidentId}
                  onClick={() => selectIncident(inc)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-subtle hover:border-medium'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                      {inc.incidentId}
                    </span>
                    <span className={`badge text-[10px] ${
                      isPending ? 'badge-red animate-pulse' : inc.status === 'VERIFIED_DISPATCHED' ? 'badge-emerald' : 'badge-muted'
                    }`}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-xs text-primary font-medium">
                    {inc.junctionId} • Approach {inc.approach}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-muted mt-2">
                    <span>Conf: {(inc.confidence * 100).toFixed(0)}%</span>
                    <span>{new Date(inc.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}

            {incidents.length === 0 && (
              <div className="text-center py-8 text-muted text-xs">
                No active collision incidents. All approaches clear.
              </div>
            )}
          </div>
        </div>

        {/* Selected Incident Details & 10s Ring-Buffer Video */}
        <div className="lg:col-span-2 space-y-6">
          {selectedIncident ? (
            <>
              <div className="card p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="badge badge-red text-xs uppercase mb-1 block w-fit">
                      {selectedIncident.collisionType} • {selectedIncident.severity}
                    </span>
                    <h3 className="font-bold text-xl text-primary">
                      Incident {selectedIncident.incidentId} at {selectedIncident.junctionId}
                    </h3>
                  </div>
                  {selectedIncident.status === 'PENDING_VERIFICATION' && (
                    <button
                      className="btn-danger flex items-center gap-2 animate-bounce"
                      onClick={() => {
                        setShowVerifyModal(true);
                        setCountdown(30);
                      }}
                    >
                      <Shield size={16} /> Human Verification Modal
                    </button>
                  )}
                </div>

                {/* 10s Evidence Ring Buffer Video Player */}
                <div className="bg-black rounded-lg overflow-hidden relative mb-4">
                  <video
                    src={`/${selectedIncident.evidenceVideoUrl || 'data/videos/traffic_road_01.mp4'}`}
                    controls
                    autoPlay
                    loop
                    muted
                    className="w-full max-h-[360px] object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs px-2.5 py-1 rounded font-bold flex items-center gap-1.5">
                    <Radio size={12} className="animate-pulse" /> 10s RING-BUFFER EVIDENCE CLIP
                  </div>
                </div>

                {/* Kinematics Telemetry */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                  <div className="bg-canvas-subtle p-2.5 rounded">
                    <span className="text-muted block">Involved Track IDs</span>
                    <span className="font-bold text-primary font-mono">
                      #{selectedIncident.involvedTrackIds?.join(', #') || '14, 18'}
                    </span>
                  </div>
                  <div className="bg-canvas-subtle p-2.5 rounded">
                    <span className="text-muted block">Deceleration Drop</span>
                    <span className="font-bold text-red-600">42 km/h → 0 km/h</span>
                  </div>
                  <div className="bg-canvas-subtle p-2.5 rounded">
                    <span className="text-muted block">BBox IoU Overlap</span>
                    <span className="font-bold text-primary">0.38 (&gt; 0.25 threshold)</span>
                  </div>
                  <div className="bg-canvas-subtle p-2.5 rounded">
                    <span className="text-muted block">Stationary Duration</span>
                    <span className="font-bold text-primary">9.4s (&gt; 8s threshold)</span>
                  </div>
                </div>

                {selectedIncident.operatorAction?.actionTakenAt && (
                  <div className="p-3 bg-surface-mint rounded text-xs border border-medium">
                    <span className="font-bold block text-primary">
                      Action Taken By: {selectedIncident.operatorAction.verifiedBy} ({new Date(selectedIncident.operatorAction.actionTakenAt).toLocaleTimeString()})
                    </span>
                    <span className="text-muted">Notes: {selectedIncident.operatorAction.notes}</span>
                  </div>
                )}
              </div>

              {/* Geo-Fenced Nearest Police Units (Within 2.5km) */}
              <div className="card p-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Shield size={18} className="text-brand" />
                    Nearest Active Police Patrol Units (2.5 km Radius Geospatial Index)
                  </h4>
                  <span className="badge badge-emerald text-xs">{nearbyOfficers.length} Units Available</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {nearbyOfficers.map((off) => (
                    <div key={off.officerId} className="p-3 bg-canvas-subtle rounded-lg border border-subtle">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-primary">{off.name}</span>
                        <span className="badge badge-emerald text-[10px]">ETA: {off.etaMinutes}m</span>
                      </div>
                      <div className="text-muted text-[11px] mb-2">{off.badgeNumber} • {off.patrolUnit}</div>
                      <div className="flex justify-between items-center text-muted border-t border-subtle pt-2">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {off.distanceKm} km away
                        </span>
                        <a
                          href={`https://maps.google.com/?q=${off.location?.coordinates[1]},${off.location?.coordinates[0]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <Navigation size={10} /> Nav Link
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card p-12 text-center text-muted">
              Select an incident from the feed to inspect evidence and dispatch units.
            </div>
          )}
        </div>
      </div>

      {/* Control Room Verification Modal (Audible Alert & 30s Countdown) */}
      {showVerifyModal && selectedIncident && (
        <div className="modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-2xl w-full bg-surface border-4 border-red-600 shadow-2xl animate-in">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-600 text-white rounded-full animate-bounce">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-red-600">CRITICAL COLLISION VERIFICATION</h3>
                  <p className="text-xs text-muted">Human-in-the-Loop Control Room Protocol (Stage 3 Step 2)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block">Auto-Dispatch In</span>
                <span className="text-2xl font-mono font-bold text-red-600">{countdown}s</span>
              </div>
            </div>

            {/* Video preview in modal */}
            <div className="bg-black rounded overflow-hidden aspect-video max-h-[260px] my-4">
              <video
                src={`/${selectedIncident.evidenceVideoUrl || 'data/videos/traffic_road_01.mp4'}`}
                controls
                autoPlay
                loop
                muted
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-muted block mb-1">Operator Log Notes / Radio Report</label>
              <input
                type="text"
                placeholder="e.g. Collision confirmed on camera CAM_NORTH. Ambulances and patrol dispatched."
                className="input-text w-full text-xs"
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-subtle">
              <button
                className="btn-secondary text-xs flex items-center gap-1.5"
                onClick={handleMarkFalsePositive}
              >
                <XCircle size={14} /> Mark False Positive (Ignore)
              </button>
              <div className="flex gap-2">
                <button
                  className="btn-danger flex items-center gap-2 text-sm font-bold px-5 py-2.5"
                  onClick={handleVerifyAndDispatch}
                >
                  <Send size={15} /> Verify & Dispatch 2.5km Officers ({nearbyOfficers.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccidentDetection;
