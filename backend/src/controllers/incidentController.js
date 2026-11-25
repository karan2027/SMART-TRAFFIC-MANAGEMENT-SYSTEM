const DBStore = require('../services/dbStore');

// GET /api/incidents - List accident events
exports.getIncidents = async (req, res, next) => {
  try {
    const { junctionId, status, limit } = req.query;
    const incidents = await DBStore.getAccidents({ junctionId, status, limit });
    res.json({ success: true, count: incidents.length, data: incidents });
  } catch (err) {
    next(err);
  }
};

// GET /api/incidents/:incidentId - Single incident
exports.getIncidentById = async (req, res, next) => {
  try {
    const incident = await DBStore.getAccidentById(req.params.incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, message: `Incident ${req.params.incidentId} not found` });
    }
    res.json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
};

// POST /api/incidents - Ingest accident alert from Python AI Engine (Stage 3 Step 1)
exports.reportIncident = async (req, res, next) => {
  try {
    const {
      junctionId,
      roadId,
      cameraId,
      approach,
      confidence,
      severity,
      collisionType,
      involvedTrackIds,
      velocitiesAtImpactKmh,
      iouOverlap,
      evidenceVideoUrl,
      keyframeImageUrl
    } = req.body;

    if (!junctionId || !roadId || typeof confidence !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'junctionId, roadId, and confidence score are required'
      });
    }

    const incident = await DBStore.createAccident({
      junctionId,
      roadId,
      cameraId: cameraId || '',
      approach: approach || 'NORTH',
      confidence,
      severity: severity || 'CRITICAL',
      collisionType: collisionType || 'VEHICLE_COLLISION',
      involvedTrackIds: involvedTrackIds || [],
      velocitiesAtImpactKmh: velocitiesAtImpactKmh || [],
      iouOverlap: iouOverlap || 0.0,
      evidenceVideoUrl: evidenceVideoUrl || '',
      keyframeImageUrl: keyframeImageUrl || ''
    });

    res.status(201).json({
      success: true,
      message: '🚨 Accident incident event recorded and control room alert triggered',
      data: incident
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/incidents/:incidentId/verify - Operator Verify & Dispatch (Stage 3 Step 2 & 3 & 4)
exports.verifyAndDispatch = async (req, res, next) => {
  try {
    const { incidentId } = req.params;
    const { verifiedBy = 'Control Operator', notes = '', autoDispatch = false } = req.body;

    const updated = await DBStore.verifyAccidentAndDispatch(incidentId, { verifiedBy, notes, autoDispatch });
    if (!updated) {
      return res.status(404).json({ success: false, message: `Incident ${incidentId} not found` });
    }

    res.json({
      success: true,
      message: `✅ Incident ${incidentId} verified. ${updated.dispatchedOfficers.length} nearest police officers dispatched within 2.5km radius.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/incidents/:incidentId/false-positive - Mark as false positive
exports.markFalsePositive = async (req, res, next) => {
  try {
    const { incidentId } = req.params;
    const { operator = 'Control Operator', reason = 'Normal queue congestion / visual artifact' } = req.body;

    const updated = await DBStore.markAccidentFalsePositive(incidentId, { operator, reason });
    if (!updated) {
      return res.status(404).json({ success: false, message: `Incident ${incidentId} not found` });
    }

    res.json({
      success: true,
      message: `Incident ${incidentId} marked as FALSE_POSITIVE and archived.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/incidents/officers/nearby - Query nearest police officers to coordinates
exports.getNearbyOfficers = async (req, res, next) => {
  try {
    const lon = parseFloat(req.query.lon) || 77.2090;
    const lat = parseFloat(req.query.lat) || 28.6139;
    const radiusKm = parseFloat(req.query.radiusKm) || 2.5;

    const officers = await DBStore.getOfficersNearLocation(lon, lat, radiusKm);
    res.json({
      success: true,
      count: officers.length,
      searchRadiusKm: radiusKm,
      coordinates: [lon, lat],
      data: officers
    });
  } catch (err) {
    next(err);
  }
};
