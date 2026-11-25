import React, { useState, useEffect } from 'react';
import { getSpatCountdown } from '../services/api';
import { Radio, Gauge, Navigation, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';

const V2XAdvisory = () => {
  const [spatData, setSpatData] = useState(null);
  const [selectedJunction, setSelectedJunction] = useState('JUNC001');
  const [distance, setDistance] = useState(150);

  useEffect(() => {
    fetchSpat();
    const interval = setInterval(fetchSpat, 2000);
    return () => clearInterval(interval);
  }, [selectedJunction]);

  const fetchSpat = async () => {
    try {
      const res = await getSpatCountdown(selectedJunction);
      if (res.success) setSpatData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const advisory = spatData?.glosaAdvisory;
  const isGreen = spatData?.currentPhaseState?.includes('GREEN');
  const recSpeed = advisory?.recommendedCruiseSpeedKmh || 42.0;

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="text-brand animate-pulse" /> V2X SPaT Broadcast & GLOSA Driver Advisory
          </h2>
          <p className="text-sm text-secondary">
            Vehicle-to-Infrastructure (V2X) Signal Phase and Timing broadcasts advising optimal cruise speed (GLOSA) to catch green waves without stopping.
          </p>
        </div>
        <select
          className="input-select text-xs"
          value={selectedJunction}
          onChange={(e) => setSelectedJunction(e.target.value)}
        >
          <option value="JUNC001">JUNC001 (Grand Cross)</option>
          <option value="JUNC002">JUNC002 (Metro Hub)</option>
        </select>
      </div>

      {/* Driver Cockpit HUD Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-8 bg-gradient-to-br from-[#090e17] to-[#16223b] text-white border-2 border-brand/50 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <span className="badge badge-emerald flex items-center gap-1.5 text-xs py-1 px-3">
              <Radio size={13} className="animate-pulse" /> V2X SAE J2735 SPaT STREAM ACTIVE
            </span>
            <span className="font-mono text-xs text-gray-400">
              Target Intersection: <strong>{selectedJunction}</strong>
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 my-6">
            {/* Speed Gauge Display */}
            <div className="text-center">
              <span className="text-xs text-gray-400 uppercase tracking-widest block mb-1">
                GLOSA Recommended Cruise Speed
              </span>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-7xl font-extrabold font-mono text-emerald-400 tracking-tight">
                  {recSpeed}
                </span>
                <span className="text-xl text-gray-400 font-semibold">km/h</span>
              </div>
              <span className="text-xs text-emerald-300 font-medium block mt-2">
                Optimal velocity to clear stop-line on Green
              </span>
            </div>

            {/* Signal Phase & Countdown Display */}
            <div className="flex flex-col items-center p-6 bg-black/40 rounded-2xl border border-white/10 min-w-[200px]">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-3 shadow-lg ${
                isGreen ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'
              }`}>
                {isGreen ? '🟢' : '🔴'}
              </div>
              <span className="text-3xl font-extrabold font-mono text-white">
                {advisory?.currentPhaseRemainingSeconds || 28}s
              </span>
              <span className="text-xs text-gray-400 mt-1 uppercase font-semibold">
                {spatData?.activeDirection} Approach Remaining
              </span>
            </div>
          </div>

          {/* Advisory banner */}
          <div className="mt-4 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-3">
            <Navigation size={22} className="text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-medium text-emerald-200">
              {advisory?.advice || 'Maintain cruise speed to pass green wave safely.'}
            </span>
          </div>
        </div>

        {/* Telemetry & Protocol Specifications */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <Gauge size={18} className="text-brand" /> SPaT Packet Breakdown
            </h3>

            <div className="space-y-3 text-xs">
              <div className="info-row">
                <span className="text-muted">Standard Protocol:</span>
                <span className="font-mono font-bold text-primary">SAE J2735 / ETSI CAM</span>
              </div>
              <div className="info-row">
                <span className="text-muted">Broadcast Interface:</span>
                <span className="font-mono font-bold text-primary">REST / SSE / MQTT</span>
              </div>
              <div className="info-row">
                <span className="text-muted">Distance to Stop Line:</span>
                <span className="font-mono font-bold text-primary">{advisory?.distanceToStopLineMeters || 150}m</span>
              </div>
              <div className="info-row">
                <span className="text-muted">Driver Recommended Action:</span>
                <span className="badge badge-emerald text-xs">{advisory?.driverAction || 'MAINTAIN_SPEED'}</span>
              </div>
            </div>

            <hr className="my-4 border-subtle" />

            <div className="text-xs text-muted leading-relaxed">
              <strong>Environmental Impact:</strong> GLOSA speed harmonization prevents hard braking and cold starts, reducing fuel consumption at intersections by 18-22%.
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-subtle text-xs text-muted">
            Last Packet Broadcast: {new Date(spatData?.timestamp || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2XAdvisory;
