import React, { useState, useEffect } from 'react';
import { getViolations, reviewViolation, recordViolation } from '../services/api';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Camera,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const VIOLATION_TYPES = [
  { id: 'ALL', label: 'All Violations' },
  { id: 'RED_LIGHT_JUMP', label: 'Red-Light Jump' },
  { id: 'WRONG_SIDE_DRIVING', label: 'Wrong-Side Driving' },
  { id: 'HELMET_VIOLATION', label: 'No Helmet' },
  { id: 'TRIPLE_RIDING', label: 'Triple Riding' },
  { id: 'OVERSPEEDING', label: 'Overspeeding' }
];

const TrafficViolations = () => {
  const [violations, setViolations] = useState([]);
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchViolations();
    const interval = setInterval(fetchViolations, 4000);
    return () => clearInterval(interval);
  }, [selectedType]);

  const fetchViolations = async () => {
    try {
      const typeParam = selectedType === 'ALL' ? null : selectedType;
      const res = await getViolations({ violationType: typeParam });
      if (res.success) {
        setViolations(res.data);
        if (!selectedViolation && res.data.length > 0) {
          setSelectedViolation(res.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status) => {
    if (!selectedViolation) return;
    try {
      const res = await reviewViolation(selectedViolation.violationId, {
        reviewStatus: status,
        reviewedBy: 'Traffic Patrol Officer 102',
        notes: status === 'VERIFIED' ? 'Violation verified via trajectory evidence.' : 'Rejected upon manual review.'
      });
      if (res.success) {
        fetchViolations();
      }
    } catch (err) {
      alert(`Review error: ${err.message}`);
    }
  };

  const handleSimulateViolation = async (type) => {
    try {
      await recordViolation({
        violationType: type,
        junctionId: 'JUNC001',
        roadId: 'ROAD_N01',
        approach: 'NORTH',
        vehicleTrackId: Math.floor(10 + Math.random() * 90),
        vehicleClass: type.includes('HELMET') || type.includes('TRIPLE') ? 'motorcycle' : 'car',
        plateNumber: 'DL04MB' + Math.floor(1000 + Math.random() * 9000),
        confidence: 0.96,
        measuredSpeedKmh: type === 'OVERSPEEDING' ? 74.5 : 35.0,
        speedLimitKmh: 50.0,
        fineAmountInr: type === 'RED_LIGHT_JUMP' ? 2000 : 1000
      });
      fetchViolations();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-amber-500" /> Automated Traffic Violation Detection & E-Challan
          </h2>
          <p className="text-sm text-secondary">
            AI enforcement algorithms detecting red-light jumping, wrong-side driving, helmet violations, triple riding, and speeding.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => handleSimulateViolation('RED_LIGHT_JUMP')}
          >
            + Simulate Red Light
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={() => handleSimulateViolation('WRONG_SIDE_DRIVING')}
          >
            + Simulate Wrong-Side
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={() => handleSimulateViolation('TRIPLE_RIDING')}
          >
            + Simulate Triple Riding
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-subtle">
        {VIOLATION_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              selectedType === t.id
                ? 'bg-brand text-white shadow-sm'
                : 'bg-surface text-muted hover:text-primary hover:bg-surface-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Violations List */}
        <div className="card p-4">
          <h3 className="font-bold text-base mb-3 flex justify-between items-center">
            <span>Violations Queue</span>
            <span className="badge badge-amber text-xs">{violations.length} Cases</span>
          </h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {violations.map((v) => {
              const isSelected = selectedViolation?.violationId === v.violationId;
              return (
                <div
                  key={v.violationId}
                  onClick={() => setSelectedViolation(v)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-brand bg-surface-mint/40' : 'border-subtle hover:border-medium'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="badge badge-muted text-[10px] font-bold uppercase">
                      {v.violationType.replace(/_/g, ' ')}
                    </span>
                    <span className={`badge text-[10px] ${
                      v.reviewStatus === 'VERIFIED' ? 'badge-emerald' : v.reviewStatus === 'PENDING' ? 'badge-amber' : 'badge-muted'
                    }`}>
                      {v.reviewStatus}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono font-bold text-primary mt-2">
                    <span>{v.plateNumber}</span>
                    <span className="text-amber-600">₹{v.fineAmountInr}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-muted mt-2 border-t border-subtle pt-1.5">
                    <span>{v.junctionId} ({v.approach})</span>
                    <span>{new Date(v.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}

            {violations.length === 0 && (
              <div className="text-center py-8 text-muted text-xs">
                No violations found in this category.
              </div>
            )}
          </div>
        </div>

        {/* Selected Violation Evidence & E-Challan Preview */}
        <div className="lg:col-span-2">
          {selectedViolation ? (
            <div className="card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="badge badge-amber text-xs font-bold uppercase block w-fit mb-1">
                    {selectedViolation.violationType.replace(/_/g, ' ')}
                  </span>
                  <h3 className="font-bold text-xl text-primary">
                    Digital E-Challan #{selectedViolation.eChallanNumber}
                  </h3>
                  <span className="text-xs text-muted block mt-0.5">
                    Violation ID: {selectedViolation.violationId}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted block">Prescribed Penalty</span>
                  <span className="text-2xl font-bold font-mono text-primary">₹{selectedViolation.fineAmountInr}</span>
                </div>
              </div>

              {/* Evidence Graphic Box */}
              <div className="bg-black rounded-lg aspect-video max-h-[300px] overflow-hidden flex items-center justify-center relative mb-4">
                <video
                  src="/data/videos/traffic_road_01.mp4"
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded font-mono border border-white/20">
                  <span>Track #{selectedViolation.vehicleTrackId}</span> | Plate: <strong>{selectedViolation.plateNumber}</strong> | Confidence: {(selectedViolation.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {/* Verification & Metadata Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-6">
                <div className="bg-canvas-subtle p-2.5 rounded">
                  <span className="text-muted block">Location / Approach</span>
                  <span className="font-bold text-primary">{selectedViolation.junctionId} ({selectedViolation.approach})</span>
                </div>
                <div className="bg-canvas-subtle p-2.5 rounded">
                  <span className="text-muted block">Vehicle Class</span>
                  <span className="font-bold text-primary capitalize">{selectedViolation.vehicleClass}</span>
                </div>
                <div className="bg-canvas-subtle p-2.5 rounded">
                  <span className="text-muted block">Indian Plate Valid</span>
                  <span className="font-bold text-emerald-600">
                    {selectedViolation.isPlateFormatValidIndian ? 'YES (State Verified)' : 'NO (Uncertain)'}
                  </span>
                </div>
                <div className="bg-canvas-subtle p-2.5 rounded">
                  <span className="text-muted block">Timestamp</span>
                  <span className="font-bold text-primary">{new Date(selectedViolation.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Review Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-subtle">
                <div className="text-xs text-muted">
                  Review Status: <strong className="text-primary">{selectedViolation.reviewStatus}</strong>
                  {selectedViolation.reviewedBy && ` (by ${selectedViolation.reviewedBy})`}
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs flex items-center gap-1.5 text-red-600"
                    onClick={() => handleReview('REJECTED')}
                  >
                    <XCircle size={14} /> Reject False Positive
                  </button>
                  <button
                    className="btn-primary text-xs flex items-center gap-1.5"
                    onClick={() => handleReview('VERIFIED')}
                  >
                    <CheckCircle size={14} /> Verify & Issue E-Challan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-muted">
              Select a violation from the queue to review evidence and confirm e-challan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrafficViolations;
