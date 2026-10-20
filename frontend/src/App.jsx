import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import VideoAnalysis from './pages/VideoAnalysis';
import TrafficAnalytics from './pages/TrafficAnalytics';
import RoadDetails from './pages/RoadDetails';
import AnalysisHistory from './pages/AnalysisHistory';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-wrapper">
          <Navbar selectedRoad="ROAD001" selectedCamera="CAM001" />
          <main className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analysis" element={<VideoAnalysis />} />
              <Route path="/analytics" element={<TrafficAnalytics />} />
              <Route path="/roads" element={<RoadDetails />} />
              <Route path="/history" element={<AnalysisHistory />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
