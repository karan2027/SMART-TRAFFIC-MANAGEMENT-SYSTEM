const DBStore = require('../services/dbStore');

// GET /api/hazards - List animal & road hazards
exports.getHazards = async (req, res, next) => {
  try {
    const { junctionId, status } = req.query;
    const hazards = await DBStore.getAnimalHazards({ junctionId, status });
    res.json({ success: true, count: hazards.length, data: hazards });
  } catch (err) {
    next(err);
  }
};

// POST /api/hazards - Report animal hazard from AI perception engine
exports.reportHazard = async (req, res, next) => {
  try {
    const {
      junctionId,
      roadId,
      cameraId,
      approach,
      animalClass,
      confidence,
      consecutiveFramesObserved,
      hazardState
    } = req.body;

    if (!junctionId || !roadId || !animalClass) {
      return res.status(400).json({
        success: false,
        message: 'junctionId, roadId, and animalClass are required'
      });
    }

    // Determine tiered mitigation according to Stage 3 Section 3
    // Moving Crossing: 10-15s All-Red caution pause
    // Stationary Sitting Cattle: max 30s Red hold, then transition to Flashing Amber
    const state = hazardState || 'MOVING_CROSSING';
    const mitigation = state === 'MOVING_CROSSING'
      ? 'ALL_RED_CAUTION_PAUSE'
      : 'FLASHING_AMBER_PROCEED_WITH_CAUTION';

    const hazard = await DBStore.createAnimalHazard({
      junctionId,
      roadId,
      cameraId: cameraId || '',
      approach: approach || 'NORTH',
      animalClass: animalClass.toUpperCase(),
      confidence: confidence || 0.85,
      consecutiveFramesObserved: consecutiveFramesObserved || 12,
      hazardState: state,
      signalMitigation: mitigation,
      municipalDispatched: true
    });

    // Actuate junction signal mode to caution
    await DBStore.updateSignalPhase(junctionId, {
      activeDirection: approach || 'NORTH',
      phaseState: mitigation === 'ALL_RED_CAUTION_PAUSE' ? 'HAZARD_ALL_RED_PAUSE' : 'HAZARD_FLASHING_AMBER',
      remainingSeconds: mitigation === 'ALL_RED_CAUTION_PAUSE' ? 15 : 30
    });

    res.status(201).json({
      success: true,
      message: `Animal hazard mitigation triggered: ${mitigation} on ${junctionId}`,
      data: hazard
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/hazards/:hazardId/resolve - Resolve hazard & clear signal caution
exports.resolveHazard = async (req, res, next) => {
  try {
    const { hazardId } = req.params;
    const { squadNotes = 'Carriageway cleared by municipal squad' } = req.body;

    const resolved = await DBStore.resolveAnimalHazard(hazardId, squadNotes);
    if (!resolved) {
      return res.status(404).json({ success: false, message: `Hazard ${hazardId} not found` });
    }

    // Restore junction to ADAPTIVE mode
    await DBStore.updateSignalPhase(resolved.junctionId, {
      activeDirection: resolved.approach || 'NORTH',
      phaseState: 'GREEN_ACTIVE',
      remainingSeconds: 30
    });

    res.json({
      success: true,
      message: `Animal hazard ${hazardId} resolved. Normal traffic flow restored.`,
      data: resolved
    });
  } catch (err) {
    next(err);
  }
};
