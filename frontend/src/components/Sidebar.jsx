import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, BarChart2, MapPin, History, Activity } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="sidebar" aria-label="System Navigation">
      <div className="brand-header">
        <div className="brand-logo-box">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="brand-title">STMS Control</h1>
          <span className="brand-subtitle">Smart Traffic Management</span>
        </div>
      </div>

      <nav aria-label="Main Menu">
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/analysis" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Video size={17} />
              <span>Video Analysis</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
              <BarChart2 size={17} />
              <span>Traffic Analytics</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/roads" className={({ isActive }) => (isActive ? 'active' : '')}>
              <MapPin size={17} />
              <span>Corridor Details</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
              <History size={17} />
              <span>Analysis Logs</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--brand-accent)', letterSpacing: '0.01em', lineHeight: '1.3' }}>
          Stage 1: Detection and Recognition
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: '500' }}>
          Recorded Video
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
