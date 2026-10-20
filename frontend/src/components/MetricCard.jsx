import React from 'react';

const MetricCard = ({ title, value, subtext, icon: Icon, color = '#0284c7' }) => {
  return (
    <div className="glass-panel metric-card">
      {Icon && (
        <div 
          className="metric-icon" 
          style={{ 
            color, 
            backgroundColor: `${color}18`, 
            border: `1px solid ${color}35` 
          }}
          aria-hidden="true"
        >
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
