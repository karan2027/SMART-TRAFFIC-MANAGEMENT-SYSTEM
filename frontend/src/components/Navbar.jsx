import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Clock, Server } from 'lucide-react';

const Navbar = ({ selectedRoad = 'ROAD001', selectedCamera = 'CAM001' }) => {
  const [timeStr, setTimeStr] = useState('');

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
          <MapPin size={15} color="#0284c7" />
          <span>Corridor: <strong>{selectedRoad}</strong></span>
        </div>
        <div className="breadcrumb-tag">
          <Camera size={15} color="#0284c7" />
          <span>Camera: <strong>{selectedCamera}</strong></span>
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
      </div>
    </header>
  );
};

export default Navbar;
