import React from 'react';

const StatusBadge = ({ level, type = 'congestion' }) => {
  if (!level) return <span className="status-badge normal">NORMAL</span>;

  const val = String(level).toUpperCase();
  let className = 'status-badge normal';

  if (val === 'LOW' || val === 'NORMAL') {
    className = 'status-badge low';
  } else if (val === 'MODERATE') {
    className = 'status-badge moderate';
  } else if (val === 'HIGH') {
    className = 'status-badge high';
  } else if (val === 'SEVERE' || val === 'VERY_HIGH') {
    className = 'status-badge severe';
  }

  return (
    <span className={className} role="status">
      {val.replace('_', ' ')}
    </span>
  );
};

export default StatusBadge;
