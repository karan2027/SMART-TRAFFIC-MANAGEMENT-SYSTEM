import React from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const JobProgressBar = ({ progress = 0, status = 'processing', stageMessage = '', currentFrame = 0, totalFrames = 0 }) => {
  const getStatusColor = () => {
    if (status === 'completed') return 'var(--status-low-text)';
    if (status === 'failed') return 'var(--status-severe-text)';
    return 'var(--brand-accent)';
  };

  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div style={{ margin: '1rem 0' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', marginBottom: '0.45rem', fontWeight: '600' }}>
        <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {status === 'processing' && <Loader2 size={14} className="animate-spin" color="var(--brand-accent)" />}
          {status === 'completed' && <CheckCircle2 size={14} color="var(--status-low-text)" />}
          {status === 'failed' && <AlertTriangle size={14} color="var(--status-severe-text)" />}
          <span>Pipeline State: <strong style={{ color: getStatusColor() }}>{status}</strong></span>
        </span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
          {pct}%
        </span>
      </div>

      <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: status === 'completed' ? 'var(--status-low-text)' : status === 'failed' ? 'var(--status-severe-text)' : 'var(--brand-primary)',
            borderRadius: 'var(--radius-pill)',
            transition: 'width 0.25s ease'
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          {status === 'processing' && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-accent)', display: 'inline-block' }}></span>
          )}
          <span>{stageMessage || (status === 'completed' ? 'Processing finished' : 'Preparing execution...')}</span>
        </span>
        {totalFrames > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>
            Frame {currentFrame || 0} / {totalFrames}
          </span>
        )}
      </div>
    </div>
  );
};

export default JobProgressBar;
