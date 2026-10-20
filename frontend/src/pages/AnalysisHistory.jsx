import React, { useState, useEffect } from 'react';
import { History, Play, CheckCircle2, XCircle, Clock, FileText, RefreshCw, Download, Video } from 'lucide-react';
import { getAnalysisJobs } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const AnalysisHistory = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await getAnalysisJobs();
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch jobs history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="loading-box" role="status">
        <div className="spinner" aria-hidden="true"></div>
        <p>Loading Video Processing Run History...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Video Analysis Execution Logs</h2>
          <p className="page-subtitle">
            Historical audit log of past computer vision analysis runs, generated output videos, vehicle detections, and traffic congestion results.
          </p>
        </div>
        <button 
          onClick={() => fetchHistory(true)} 
          disabled={refreshing} 
          className="btn-secondary"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Updating...' : 'Refresh Logs'}</span>
        </button>
      </div>

      <div className="glass-panel">
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <History size={15} color="var(--brand-accent)" />
          <span>Recorded Execution Runs ({jobs.length})</span>
        </h3>

        {jobs.length === 0 ? (
          <div className="empty-box">
            <p>No video analysis jobs found in database. Run a video analysis from the workspace to record jobs.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Video File</th>
                  <th>Corridor / Camera</th>
                  <th>Execution Timestamp</th>
                  <th>Execution State</th>
                  <th>Vehicles</th>
                  <th>Speed (km/h)</th>
                  <th>Congestion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const sum = job.resultSummary;
                  const outputVideoName = sum?.outputs?.processedVideoFilename || job.processedVideoPath?.split(/[\/\\]/).pop();

                  return (
                    <tr key={job._id || job.jobId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: 'var(--brand-accent)', fontWeight: '700' }}>
                        {job.jobId}
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {job.videoFilename || 'video.mp4'}
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{job.roadId}</span>
                        <span style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', display: 'block' }}>{job.cameraId}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td>
                        {job.status === 'completed' && (
                          <span className="status-badge low" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle2 size={12} /> COMPLETED
                          </span>
                        )}
                        {job.status === 'processing' && (
                          <span className="status-badge moderate" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} /> {job.progress || 0}%
                          </span>
                        )}
                        {job.status === 'failed' && (
                          <span className="status-badge severe" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <XCircle size={12} /> FAILED
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                        {sum?.vehicles?.total ?? '-'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {sum?.traffic?.averageSpeedKmh ? `${sum.traffic.averageSpeedKmh} km/h` : '-'}
                      </td>
                      <td>
                        {sum?.traffic?.congestionLevel ? (
                          <StatusBadge level={sum.traffic.congestionLevel} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {outputVideoName ? (
                          <a
                            href={`/outputs/${outputVideoName}`}
                            download={outputVideoName}
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', textDecoration: 'none' }}
                            title="Download Processed MP4 Video"
                          >
                            <Download size={12} /> MP4
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisHistory;
