import React from 'react';

const MetricCard = ({ title, value, subtext, icon: Icon, color = 'var(--brand-primary)' }) => {
  const isCssVar = typeof color === 'string' && color.startsWith('var(');
  const iconStyle = isCssVar
    ? {
        color: color,
        backgroundColor: 'var(--bg-surface-mint)',
        border: '1px solid var(--border-medium)'
      }
    : {
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}35`
      };

  return (
    <div className="glass-panel metric-card">
      {Icon && (
        <div className="metric-icon" style={iconStyle} aria-hidden="true">
          <Icon size={20} />
        </div>
      )}
      <div>
        <div className="metric-label">{title}</div>
        <div className="metric-value">{value}</div>
        {subtext && <div className="metric-subtext">{subtext}</div>}
      </div>
    </div>
  );
};

export default MetricCard;
