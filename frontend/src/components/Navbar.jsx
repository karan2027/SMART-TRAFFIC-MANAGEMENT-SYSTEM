import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Clock, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Navbar = ({ selectedRoad = 'ROAD001', selectedCamera = 'CAM001' }) => {
  const [timeStr, setTimeStr] = useState('');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top-navbar" role="banner">
      <div className="nav-breadcrumbs">
        <div className="breadcrumb-tag">
          <MapPin size={15} color="var(--brand-primary)" />
          <span>Corridor: <strong>{selectedRoad}</strong></span>
        </div>
        <div className="breadcrumb-tag">
          <Camera size={15} color="var(--brand-primary)" />
          <span>Camera: <strong>{selectedCamera}</strong></span>
        </div>
        <div className="portal-badge">
          <ShieldCheck size={13} color="var(--brand-primary)" />
          <span>Traffic Operations</span>
        </div>
      </div>

      <div className="header-meta">
        <div className="status-indicator">
          <div className="pulse-dot"></div>
          <span>OPERATIONAL</span>
        </div>
        
        <div className="time-badge">
          <Clock size={14} />
          <span>{timeStr}</span>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          aria-label={`Switch to ${theme === 'light' ? 'Night Operations' : 'Government Portal'} mode`}
          title={`Switch to ${theme === 'light' ? 'Night Operations (Dark Mode)' : 'Government Portal (Light Mode)'}`}
        >
          {theme === 'light' ? (
            <>
              <Moon size={14} style={{ color: 'var(--brand-deep-green)' }} />
              <span>Night Mode</span>
            </>
          ) : (
            <>
              <Sun size={14} style={{ color: 'var(--brand-saffron)' }} />
              <span>Day Mode</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
