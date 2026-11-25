import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Camera,
  Compass,
  Siren,
  Route,
  AlertTriangle,
  FileText,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Radio,
  Bell,
  BarChart2,
  Cpu,
  Activity
} from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="sidebar" aria-label="System Navigation">
      <div className="brand-header">
        <div className="brand-logo-box">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="brand-title">AITMS Control</h1>
          <span className="brand-subtitle">Smart Traffic & Mobility</span>
        </div>
      </div>

      <nav aria-label="Main Menu" className="sidebar-nav">
        <div className="nav-group-title">CORE OPERATIONS</div>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <LayoutDashboard size={17} />
              <span>Main Dashboard</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/live" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Video size={17} />
              <span>Live Monitoring</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/cameras" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Camera size={17} />
              <span>Camera Setup</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/simulator" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Compass size={17} />
              <span>Adaptive Signals</span>
            </NavLink>
          </li>
        </ul>

        <div className="nav-group-title">INCIDENTS & EMERGENCY</div>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/accidents" className={({ isActive }) => (isActive ? 'active' : '')}>
              <AlertTriangle size={17} />
              <span>Accident Dispatch</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/emergency" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Siren size={17} />
              <span>Emergency Priority</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/corridor" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Route size={17} />
              <span>Green Corridor</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/safety" className={({ isActive }) => (isActive ? 'active' : '')}>
              <UserCheck size={17} />
              <span>Cattle & Pedestrians</span>
            </NavLink>
          </li>
        </ul>

        <div className="nav-group-title">ENFORCEMENT & MOBILITY</div>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/anpr" className={({ isActive }) => (isActive ? 'active' : '')}>
              <FileText size={17} />
              <span>ANPR & E-Challan</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/violations" className={({ isActive }) => (isActive ? 'active' : '')}>
              <ShieldAlert size={17} />
              <span>Traffic Violations</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/prediction" className={({ isActive }) => (isActive ? 'active' : '')}>
              <TrendingUp size={17} />
              <span>AI Prediction</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/v2x" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Radio size={17} />
              <span>V2X SPaT & GLOSA</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Bell size={17} />
              <span>Live Alerts</span>
            </NavLink>
          </li>
        </ul>

        <div className="nav-group-title">AUDIT & SYSTEM</div>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
              <BarChart2 size={17} />
              <span>Analytics & Reports</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/system" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Cpu size={17} />
              <span>System Health</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-title">
          AITMS Stage 3 Architecture
        </div>
        <div className="sidebar-footer-desc">
          Road Safety & City-Scale Mobility
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
