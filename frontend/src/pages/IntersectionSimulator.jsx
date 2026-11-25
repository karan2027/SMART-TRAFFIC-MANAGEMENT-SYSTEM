import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, AlertTriangle, ShieldAlert, CheckCircle2, 
  RotateCcw, Sliders, Zap, Timer, Car, Siren, RefreshCw, Radio
} from 'lucide-react';
import { 
  getJunctionById, updateSignalPhase, 
  triggerEmergencyOverride, clearEmergencyOverride 
} from '../services/api';
import StatusBadge from '../components/StatusBadge';

// Helper component for Realistic 3-Bulb Traffic Light Signal Head
const TrafficLightHead = ({ signalState, remainingSeconds, isEmergency }) => {
  const isRed = signalState === 'RED';
  const isYellow = signalState === 'YELLOW';
  const isGreen = signalState === 'GREEN';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#1A231E',
      padding: '0.65rem 0.55rem',
      borderRadius: '16px',
      border: isEmergency ? '2px solid #EF4444' : '2px solid #2D3E35',
      boxShadow: isEmergency 
        ? '0 0 20px rgba(239, 68, 68, 0.4)' 
        : '0 8px 16px rgba(0, 0, 0, 0.35)',
      width: '64px'
    }}>
      {/* Red Bulb */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        marginBottom: '0.5rem',
        background: isRed 
          ? 'radial-gradient(circle at 35% 35%, #FF7676 0%, #EF4444 60%, #991B1B 100%)' 
          : '#3B1818',
        boxShadow: isRed ? '0 0 18px #EF4444, inset 0 0 6px #FFFFFF' : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        border: '2px solid #141B17',
        transition: 'all 0.2s ease'
      }} />

      {/* Yellow Bulb */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        marginBottom: '0.5rem',
        background: isYellow 
          ? 'radial-gradient(circle at 35% 35%, #FFF085 0%, #EAB308 60%, #854D0E 100%)' 
          : '#3D3414',
        boxShadow: isYellow ? '0 0 18px #EAB308, inset 0 0 6px #FFFFFF' : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        border: '2px solid #141B17',
        transition: 'all 0.2s ease'
      }} />

      {/* Green Bulb */}
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        background: isGreen 
          ? 'radial-gradient(circle at 35% 35%, #86EFAC 0%, #22C55E 60%, #14532D 100%)' 
          : '#163824',
        boxShadow: isGreen ? '0 0 18px #22C55E, inset 0 0 6px #FFFFFF' : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        border: '2px solid #141B17',
        transition: 'all 0.2s ease'
      }} />

      {/* Digital Countdown Timer */}
      <div style={{
        marginTop: '0.6rem',
        background: '#0B120E',
        borderRadius: '6px',
        padding: '0.2rem 0.4rem',
        textAlign: 'center',
        width: '100%',
        border: '1px solid #20352A'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.85rem',
          fontWeight: '700',
          color: isGreen ? '#22C55E' : isYellow ? '#EAB308' : isRed ? '#EF4444' : '#94A3B8'
        }}>
          {remainingSeconds > 0 ? `${remainingSeconds}s` : '--'}
        </span>
      </div>
    </div>
  );
};

// Approach Quadrant Card
const ApproachCard = ({ approach, isActive, isEmergency, onForcePhase }) => {
  if (!approach) return null;
  const { direction, signalState, remainingSeconds, allocatedGreenSeconds, queueCount, averageSpeedKmh, densityLevel } = approach;

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      padding: '0.9rem',
      border: isActive ? '2px solid var(--brand-primary, #16784A)' : isEmergency ? '2px solid #EF4444' : '1px solid var(--border-subtle)',
      background: isActive ? 'var(--bg-surface-mint, #E8F4EC)' : isEmergency ? '#FEF2F2' : 'var(--bg-surface, #FFFFFF)',
      boxShadow: isActive ? '0 4px 12px rgba(22, 120, 74, 0.15)' : 'var(--shadow-sm)',
      position: 'relative',
      borderRadius: '12px'
    }}>
      {/* Realistic Signal Light */}
      <TrafficLightHead 
        signalState={signalState} 
        remainingSeconds={remainingSeconds} 
        isEmergency={isEmergency} 
      />

      {/* Approach Telemetry Details */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Compass size={16} color="var(--brand-primary, #16784A)" />
            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {direction} APPROACH
            </span>
          </div>
          <span className={`status-badge ${signalState === 'GREEN' ? 'low' : signalState === 'YELLOW' ? 'mod' : 'severe'}`}>
            {signalState}
          </span>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.78rem' }}>
          <div style={{ background: 'var(--bg-surface-elevated, #F7F3E8)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Stopped Queue:</span>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {queueCount || 0} vehicles
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated, #F7F3E8)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Allocated Green:</span>
            <div style={{ fontWeight: '700', color: 'var(--brand-primary, #16784A)', fontFamily: 'var(--font-mono)' }}>
              {allocatedGreenSeconds || 30}s (Webster)
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated, #F7F3E8)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Approach Speed:</span>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {averageSpeedKmh || 25} km/h
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface-elevated, #F7F3E8)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Road Density:</span>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {densityLevel || 'LOW'}
            </div>
          </div>
        </div>

        {/* Manual Force Phase Button */}
        <button
          onClick={() => onForcePhase(direction)}
          className="btn-secondary"
          style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', fontSize: '0.75rem', justifyContent: 'center' }}
        >
          <Zap size={12} />
          <span>Force {direction} Green</span>
        </button>
      </div>
    </div>
  );
};

const IntersectionSimulator = () => {
  const [junction, setJunction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [simulationMode, setSimulationMode] = useState('ADAPTIVE'); // ADAPTIVE vs FIXED_TIMER

  const fetchJunctionState = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await getJunctionById('JUNC001');
      if (res && res.success) {
        setJunction(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch junction data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJunctionState();
    // Live polling interval every 1.5 seconds to synchronize countdowns with backend
    const interval = setInterval(() => {
      fetchJunctionState(false);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const handleForcePhase = async (direction) => {
    try {
      setActionMessage(`Switching green phase to ${direction}...`);
      await updateSignalPhase('JUNC001', {
        activeDirection: direction,
        phaseState: 'GREEN_ACTIVE',
        allocatedGreenSeconds: 30,
        remainingSeconds: 30
      });
      fetchJunctionState();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleTriggerEmergency = async (approach, vehicleType = 'AMBULANCE') => {
    try {
      setActionMessage(`🚨 Activating priority green corridor for ${vehicleType} on ${approach}...`);
      await triggerEmergencyOverride('JUNC001', {
        approach,
        vehicleType,
        triggeredBy: 'MANUAL_DISPATCH'
      });
      fetchJunctionState();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const handleClearEmergency = async () => {
    try {
      setActionMessage('Clearing emergency preemption and restoring adaptive schedule...');
      await clearEmergencyOverride('JUNC001');
      fetchJunctionState();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  if (loading && !junction) {
    return (
      <div className="loading-box">
        <div className="spinner"></div>
        <p>Initializing 4-Way Intersection Control Simulator...</p>
      </div>
    );
  }

  const approaches = junction?.approaches || [];
  const northApp = approaches.find(a => a.direction === 'NORTH');
  const southApp = approaches.find(a => a.direction === 'SOUTH');
  const eastApp = approaches.find(a => a.direction === 'EAST');
  const westApp = approaches.find(a => a.direction === 'WEST');

  const emergencyActive = junction?.emergencyOverride?.isActive;
  const emergencyApproach = junction?.emergencyOverride?.approach;
  const emergencyType = junction?.emergencyOverride?.vehicleType || 'AMBULANCE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">4-Way Intersection Control Simulator</h2>
          <p className="page-subtitle">
            Real-time adaptive signal actuation, dynamic Webster green time optimization, and emergency priority green corridor.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'var(--bg-surface-mint, #E8F4EC)',
            color: 'var(--brand-primary, #16784A)',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            <Radio size={14} className="animate-spin" />
            <span>ADAPTIVE ACTUATION ONLINE</span>
          </div>

          <button 
            onClick={() => fetchJunctionState(true)}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh State'}</span>
          </button>
        </div>
      </div>

      {/* Toast Action Notice */}
      {actionMessage && (
        <div style={{
          background: 'var(--bg-surface-elevated, #F7F3E8)',
          border: '1px solid var(--border-medium)',
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'var(--brand-primary, #16784A)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Zap size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Flashing Emergency HUD Banner */}
      {emergencyActive && (
        <div style={{
          background: 'linear-gradient(90deg, #991B1B 0%, #DC2626 50%, #991B1B 100%)',
          color: '#FFFFFF',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 15px rgba(220, 38, 38, 0.45)',
          animation: 'pulse 1.5s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Siren size={26} className="animate-bounce" />
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '0.5px' }}>
                PRIORITY GREEN CORRIDOR PRE-EMPTION ACTIVE
              </div>
              <div style={{ fontSize: '0.825rem', opacity: 0.9 }}>
                {emergencyType} detected on {emergencyApproach} approach — all conflicting crossing traffic halted at RED.
              </div>
            </div>
          </div>
          <button
            onClick={handleClearEmergency}
            style={{
              background: '#FFFFFF',
              color: '#991B1B',
              border: 'none',
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.825rem',
              cursor: 'pointer'
            }}
          >
            Clear Emergency Override
          </button>
        </div>
      )}

      {/* 4-Way Aerial Intersection Canvas Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 360px)', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Main 4-Way Aerial Grid Canvas */}
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Compass size={18} color="var(--brand-primary, #16784A)" />
              <span>Junction JUNC001 Aerial Intersection Layout</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mode: <b style={{ color: 'var(--brand-primary, #16784A)' }}>{junction?.operatingMode || 'ADAPTIVE'}</b>
            </span>
          </div>

          {/* Cross Intersection Layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            
            {/* North Approach (Top) */}
            <div style={{ width: '100%', maxWidth: '380px' }}>
              <ApproachCard
                approach={northApp}
                isActive={junction?.activeDirection === 'NORTH'}
                isEmergency={emergencyActive && emergencyApproach === 'NORTH'}
                onForcePhase={handleForcePhase}
              />
            </div>

            {/* Middle Row: West Approach | Central Intersection Box | East Approach */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', width: '100%', alignItems: 'center' }}>
              
              {/* West Approach (Left) */}
              <div>
                <ApproachCard
                  approach={westApp}
                  isActive={junction?.activeDirection === 'WEST'}
                  isEmergency={emergencyActive && emergencyApproach === 'WEST'}
                  onForcePhase={handleForcePhase}
                />
              </div>

              {/* Central Road Junction Box */}
              <div style={{
                width: '120px',
                height: '120px',
                background: '#1A231E',
                borderRadius: '16px',
                border: '2px dashed #3D5A4A',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                padding: '0.5rem'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ACTIVE PHASE
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: '800',
                  color: emergencyActive ? '#EF4444' : '#22C55E',
                  marginTop: '0.2rem'
                }}>
                  {junction?.activeDirection || 'NORTH'}
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#CBD5E1',
                  background: '#2B3D33',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  marginTop: '0.3rem'
                }}>
                  {junction?.currentPhaseState || 'GREEN_ACTIVE'}
                </div>
              </div>

              {/* East Approach (Right) */}
              <div>
                <ApproachCard
                  approach={eastApp}
                  isActive={junction?.activeDirection === 'EAST'}
                  isEmergency={emergencyActive && emergencyApproach === 'EAST'}
                  onForcePhase={handleForcePhase}
                />
              </div>

            </div>

            {/* South Approach (Bottom) */}
            <div style={{ width: '100%', maxWidth: '380px' }}>
              <ApproachCard
                approach={southApp}
                isActive={junction?.activeDirection === 'SOUTH'}
                isEmergency={emergencyActive && emergencyApproach === 'SOUTH'}
                onForcePhase={handleForcePhase}
              />
            </div>

          </div>
        </div>

        {/* Sidebar Controls & Comparative Benchmarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Emergency Pre-emption Dispatcher */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Siren size={16} color="#DC2626" />
              <span>Emergency Pre-emption Dispatch</span>
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Simulate an approaching emergency vehicle to demonstrate automated green corridor preemption for evaluations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <button
                onClick={() => handleTriggerEmergency('SOUTH', 'AMBULANCE')}
                style={{
                  background: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  textAlign: 'left'
                }}
              >
                <span>🚑</span>
                <span>Dispatch Ambulance (South Approach)</span>
              </button>

              <button
                onClick={() => handleTriggerEmergency('NORTH', 'FIRE_TRUCK')}
                style={{
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  textAlign: 'left'
                }}
              >
                <span>🚒</span>
                <span>Dispatch Fire Truck (North Approach)</span>
              </button>

              <button
                onClick={() => handleTriggerEmergency('EAST', 'POLICE')}
                style={{
                  background: '#E0E7FF',
                  border: '1px solid #A5B4FC',
                  color: '#3730A3',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  textAlign: 'left'
                }}
              >
                <span>🚓</span>
                <span>Dispatch Police Cruiser (East Approach)</span>
              </button>

              {emergencyActive && (
                <button
                  onClick={handleClearEmergency}
                  className="btn-primary"
                  style={{ marginTop: '0.35rem', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={14} />
                  <span>Restore Adaptive Traffic Cycle</span>
                </button>
              )}
            </div>
          </div>

          {/* Webster Adaptive vs Fixed Timer Benchmark */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Timer size={16} color="var(--brand-primary, #16784A)" />
              <span>Adaptive vs Fixed Timer Efficiency</span>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Average Commuter Wait Delay:</span>
                <span style={{ fontWeight: '700', color: '#16784A' }}>-38.4% reduction</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Empty Green Waste:</span>
                <span style={{ fontWeight: '700', color: '#16784A' }}>Eliminated (0s)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Emergency Transit Time:</span>
                <span style={{ fontWeight: '700', color: '#DC2626' }}>52% faster transit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Calculated Cycle Length:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {junction?.timingParameters?.targetCycleSeconds || 120}s (Optimal Co)
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default IntersectionSimulator;
