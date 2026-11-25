import React, { useState, useEffect } from 'react';
import { getANPRRecords, validatePlate } from '../services/api';
import { FileText, CheckCircle, AlertTriangle, Search, RefreshCw, CreditCard, Shield, Camera } from 'lucide-react';

const ANPRPage = () => {
  const [records, setRecords] = useState([]);
  const [testPlateInput, setTestPlateInput] = useState('MH12AB1234');
  const [testResult, setTestResult] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await getANPRRecords();
      if (res.success) setRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPlate = async () => {
    try {
      const res = await validatePlate(testPlateInput);
      setTestResult(res);
    } catch (err) {
      alert(`Validation error: ${err.message}`);
    }
  };

  const filtered = records.filter(r =>
    r.plateText.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.cameraId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="text-brand" /> Automated Number Plate Recognition (ANPR) & E-Challan
          </h2>
          <p className="text-sm text-secondary">
            High-resolution vehicle license plate localization, optical character recognition, and Indian registration format validation.
          </p>
        </div>
        <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchRecords}>
          <RefreshCw size={14} /> Refresh Plates
        </button>
      </div>

      {/* Indian Plate Format Checker Widget */}
      <div className="card p-5 mb-8 bg-surface-mint border border-medium">
        <h3 className="font-bold text-base mb-2">Indian Vehicle Registration Format Validator</h3>
        <p className="text-xs text-muted mb-4">
          Validates against the Indian Motor Vehicles Act standard pattern: 2-Letter State Code + 1-2 Digit RTO Code + Series Letters + 4 Digits.
        </p>

        <div className="flex gap-3 max-w-md items-center">
          <input
            type="text"
            className="input-text font-mono font-bold uppercase text-base tracking-widest flex-1"
            placeholder="e.g. DL01CA9999"
            value={testPlateInput}
            onChange={(e) => setTestPlateInput(e.target.value)}
          />
          <button className="btn-primary text-xs font-bold py-2.5 px-4" onClick={handleTestPlate}>
            Validate Pattern
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 p-3 rounded text-xs flex items-center gap-2 ${
            testResult.isValidIndianRegistration
              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
              : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300'
          }`}>
            {testResult.isValidIndianRegistration ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>
              <strong>{testResult.plate}</strong>: {testResult.isValidIndianRegistration
                ? 'Valid Standard Indian Vehicle Registration Number.'
                : 'Invalid format. Does not match official Indian registration syntax.'}
            </span>
          </div>
        )}
      </div>

      {/* Plate Feed Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-subtle flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-base">Detected Vehicle License Plates ({filtered.length})</h3>
            <span className="badge badge-emerald text-xs">Live OCR Stream Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search plate or camera..."
              className="input-text text-xs py-1"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration Plate</th>
                <th>Validation Status</th>
                <th>OCR Confidence</th>
                <th>Vehicle Track</th>
                <th>Camera & Road</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.recordId}>
                  <td>
                    {/* Indian Plate Graphic Representation */}
                    <div className="inline-flex items-center border-2 border-black bg-white text-black px-3 py-1 rounded font-mono font-bold tracking-wider text-sm shadow-sm">
                      <span className="text-[9px] bg-blue-700 text-white px-1 py-0.5 rounded mr-1.5 font-sans font-normal">IND</span>
                      {rec.plateText}
                    </div>
                  </td>
                  <td>
                    {rec.isFormatValid ? (
                      <span className="badge badge-emerald text-xs flex items-center gap-1 w-fit">
                        <CheckCircle size={12} /> Indian Standard (Valid)
                      </span>
                    ) : (
                      <span className="badge badge-amber text-xs flex items-center gap-1 w-fit">
                        <AlertTriangle size={12} /> Non-Standard / Flagged
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-brand h-full rounded-full"
                          style={{ width: `${rec.ocrConfidence * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold">
                        {(rec.ocrConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs">Track #{rec.vehicleTrackId}</span>
                    <span className="text-[11px] text-muted block capitalize">{rec.vehicleClass}</span>
                  </td>
                  <td>
                    <span className="font-medium text-xs text-primary">{rec.cameraId}</span>
                    <span className="text-[11px] text-muted block">{rec.roadId}</span>
                  </td>
                  <td className="text-xs text-muted">
                    {new Date(rec.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-muted text-xs">
                    No license plates logged yet. Vehicle tracks with visible plates will populate automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ANPRPage;
