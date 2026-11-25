import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Core Pages
import Dashboard from './pages/Dashboard';
import LiveCameras from './pages/LiveCameras';
import CameraManagement from './pages/CameraManagement';
import IntersectionSimulator from './pages/IntersectionSimulator';

// Incidents, Safety & Emergency
import AccidentDetection from './pages/AccidentDetection';
import EmergencyMonitoring from './pages/EmergencyMonitoring';
import GreenCorridor from './pages/GreenCorridor';
import AnimalAndPedestrianSafety from './pages/AnimalAndPedestrianSafety';

// Enforcement & Mobility
import ANPRPage from './pages/ANPRPage';
import TrafficViolations from './pages/TrafficViolations';
import TrafficPrediction from './pages/TrafficPrediction';
import V2XAdvisory from './pages/V2XAdvisory';
import AlertsPage from './pages/AlertsPage';

// Analytics & System
import TrafficAnalytics from './pages/TrafficAnalytics';
import VideoAnalysis from './pages/VideoAnalysis';
import RoadDetails from './pages/RoadDetails';
import AnalysisHistory from './pages/AnalysisHistory';
import SystemHealth from './pages/SystemHealth';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app-container">
          <Sidebar />
          <div className="main-wrapper">
            <Navbar selectedRoad="ROAD001" selectedCamera="CAM001" />
            <main className="page-content">
              <Routes>
                {/* Core Operations */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveCameras />} />
                <Route path="/cameras" element={<CameraManagement />} />
                <Route path="/simulator" element={<IntersectionSimulator />} />

                {/* Incidents & Emergency */}
                <Route path="/accidents" element={<AccidentDetection />} />
                <Route path="/emergency" element={<EmergencyMonitoring />} />
                <Route path="/corridor" element={<GreenCorridor />} />
                <Route path="/safety" element={<AnimalAndPedestrianSafety />} />

                {/* Enforcement & Mobility */}
                <Route path="/anpr" element={<ANPRPage />} />
                <Route path="/violations" element={<TrafficViolations />} />
                <Route path="/prediction" element={<TrafficPrediction />} />
                <Route path="/v2x" element={<V2XAdvisory />} />
                <Route path="/alerts" element={<AlertsPage />} />

                {/* Analytics & System */}
                <Route path="/analysis" element={<VideoAnalysis />} />
                <Route path="/analytics" element={<TrafficAnalytics />} />
                <Route path="/roads" element={<RoadDetails />} />
                <Route path="/history" element={<AnalysisHistory />} />
                <Route path="/system" element={<SystemHealth />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
