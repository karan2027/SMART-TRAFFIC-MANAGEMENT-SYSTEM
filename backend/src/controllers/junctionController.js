const DBStore = require('../services/dbStore');

// Security helper: Validate alphanumeric identifier with hyphens/underscores
const isValidId = (val) => typeof val === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(val);
const VALID_DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
const VALID_PHASES = [
  'GREEN_ACTIVE',
  'YELLOW_CLEARANCE',
  'ALL_RED_CLEARANCE',
  'EMERGENCY_YELLOW_CLEARANCE',
  'EMERGENCY_ALL_RED',
  'EMERGENCY_GREEN_CORRIDOR',
  'HAZARD_ALL_RED_PAUSE',
  'HAZARD_FLASHING_AMBER'
];
const VALID_EMERGENCY_TYPES = ['AMBULANCE', 'FIRE_TRUCK', 'POLICE', 'ORGAN_TRANSPORT'];

exports.getJunctions = async (req, res, next) => {
  try {
    const junctions = await DBStore.getJunctions();
    res.json({
      success: true,
      count: junctions.length,
      data: junctions
    });
  } catch (err) {
    next(err);
  }
};

exports.getJunctionById = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    if (!isValidId(junctionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid junctionId parameter format',
        errorCode: 'INVALID_PARAM'
      });
    }

    const junction = await DBStore.getJunctionById(junctionId);
    if (!junction) {
      return res.status(404).json({
        success: false,
        message: `Junction not found with ID ${junctionId}`,
        errorCode: 'JUNCTION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: junction
    });
  } catch (err) {
    next(err);
  }
};

exports.createJunction = async (req, res, next) => {
  try {
    const {
      junctionId,
      name,
      description,
      location,
      approaches,
      timingParameters
    } = req.body;

    if (!junctionId || !isValidId(junctionId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid alphanumeric junctionId is required',
        errorCode: 'MISSING_JUNCTION_ID'
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Junction name is required',
        errorCode: 'MISSING_NAME'
      });
    }

    const existing = await DBStore.getJunctionById(junctionId);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Junction with ID ${junctionId} already exists`,
        errorCode: 'DUPLICATE_JUNCTION'
      });
    }

    // Validate 4 approaches
    if (!Array.isArray(approaches) || approaches.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'A 4-way junction must provide exactly 4 approaches (NORTH, SOUTH, EAST, WEST)',
        errorCode: 'INVALID_APPROACHES'
      });
    }

    const directions = approaches.map(a => (a.direction || '').toUpperCase());
    for (const reqDir of VALID_DIRECTIONS) {
      if (!directions.includes(reqDir)) {
        return res.status(400).json({
          success: false,
          message: `Missing required directional approach: ${reqDir}`,
          errorCode: 'MISSING_DIRECTION'
        });
      }
    }

    const newJunction = await DBStore.createJunction({
      junctionId: junctionId.toUpperCase(),
      name: name.trim(),
      description: description || '',
      location: location || {},
      approaches,
      timingParameters: timingParameters || {
        minGreenSeconds: 15,
        maxGreenSeconds: 75,
        yellowClearanceSeconds: 4,
        allRedClearanceSeconds: 2,
        targetCycleSeconds: 120
      }
    });

    res.status(201).json({
      success: true,
      message: `Junction ${newJunction.junctionId} registered successfully`,
      data: newJunction
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSignalPhase = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    let {
      activeDirection,
      phaseState = 'GREEN_ACTIVE',
      allocatedGreenSeconds,
      remainingSeconds,
      signalStates
    } = req.body;

    if (!isValidId(junctionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid junctionId parameter format',
        errorCode: 'INVALID_PARAM'
      });
    }

    if (!activeDirection || !VALID_DIRECTIONS.includes(activeDirection.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid activeDirection. Allowed: ${VALID_DIRECTIONS.join(', ')}`,
        errorCode: 'INVALID_DIRECTION'
      });
    }

    if (!VALID_PHASES.includes(phaseState)) {
      return res.status(400).json({
        success: false,
        message: `Invalid phaseState. Allowed: ${VALID_PHASES.join(', ')}`,
        errorCode: 'INVALID_PHASE'
      });
    }

    // Safety Invariant Check: Verify that multiple conflicting approaches cannot be simultaneously GREEN
    if (signalStates && typeof signalStates === 'object') {
      const greenApproaches = Object.entries(signalStates).filter(([dir, state]) => state === 'GREEN');
      if (greenApproaches.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Safety Invariant Violation: Multiple conflicting approaches cannot be GREEN simultaneously',
          errorCode: 'CONFLICTING_SIGNALS'
        });
      }
    }

    const updated = await DBStore.updateSignalPhase(junctionId, {
      activeDirection: activeDirection.toUpperCase(),
      phaseState,
      signalStates,
      remainingSeconds: typeof remainingSeconds === 'number' ? remainingSeconds : undefined,
      allocatedGreenSeconds: typeof allocatedGreenSeconds === 'number' ? allocatedGreenSeconds : undefined
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Junction not found with ID ${junctionId}`,
        errorCode: 'JUNCTION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: `Signal phase for junction ${junctionId} updated to ${activeDirection} (${phaseState})`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

exports.triggerEmergencyOverride = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    let { approach, vehicleType = 'AMBULANCE', triggeredBy = 'AI_DETECTION' } = req.body;

    if (!isValidId(junctionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid junctionId parameter format',
        errorCode: 'INVALID_PARAM'
      });
    }

    if (!approach || !VALID_DIRECTIONS.includes(approach.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid approach direction for emergency override. Allowed: ${VALID_DIRECTIONS.join(', ')}`,
        errorCode: 'INVALID_DIRECTION'
      });
    }

    if (vehicleType && !VALID_EMERGENCY_TYPES.includes(vehicleType.toUpperCase())) {
      vehicleType = 'AMBULANCE';
    }

    const updated = await DBStore.setEmergencyOverride(junctionId, {
      approach: approach.toUpperCase(),
      vehicleType: vehicleType.toUpperCase(),
      triggeredBy
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Junction not found with ID ${junctionId}`,
        errorCode: 'JUNCTION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: `🚨 Emergency green corridor activated on ${approach.toUpperCase()} approach for ${vehicleType}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

exports.clearEmergencyOverride = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    if (!isValidId(junctionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid junctionId parameter format',
        errorCode: 'INVALID_PARAM'
      });
    }

    const updated = await DBStore.clearEmergencyOverride(junctionId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Junction not found with ID ${junctionId}`,
        errorCode: 'JUNCTION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: `✅ Emergency override cleared for junction ${junctionId}. Adaptive signal mode restored.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Stage 3: V2X SPaT & GLOSA Connectivity Endpoint
 * Broadcasts Signal Phase and Timing countdowns and optimal advisory speeds.
 */
exports.getSpatCountdown = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    const junction = await DBStore.getJunctionById(junctionId);
    if (!junction) {
      return res.status(404).json({ success: false, message: `Junction ${junctionId} not found` });
    }

    const activeApp = junction.approaches.find(a => a.direction === junction.activeDirection) || junction.approaches[0];
    const remainingSec = activeApp.remainingSeconds || 25;
    const distanceMeters = 150.0; // Distance to stop line

    // GLOSA Optimal speed calculation: v = d / t (in m/s -> km/h)
    let glosaKmh = 40.0;
    if (activeApp.signalState === 'GREEN' && remainingSec > 3) {
      glosaKmh = Math.min(60.0, Math.max(20.0, (distanceMeters / remainingSec) * 3.6));
    } else {
      glosaKmh = 30.0; // Advise deceleration
    }

    const spatPacket = {
      junctionId: junction.junctionId,
      timestamp: new Date().toISOString(),
      activeDirection: junction.activeDirection,
      currentPhaseState: junction.currentPhaseState,
      approaches: junction.approaches.map(a => ({
        direction: a.direction,
        signalState: a.signalState,
        remainingSeconds: a.remainingSeconds
      })),
      glosaAdvisory: {
        distanceToStopLineMeters: distanceMeters,
        currentPhaseRemainingSeconds: remainingSec,
        recommendedCruiseSpeedKmh: parseFloat(glosaKmh.toFixed(1)),
        advice: activeApp.signalState === 'GREEN'
          ? `Maintain ${glosaKmh.toFixed(0)} km/h to clear junction on green`
          : 'Prepare to decelerate; signal changing'
      }
    };

    res.json({ success: true, data: spatPacket });
  } catch (err) {
    next(err);
  }
};

/**
 * Stage 3: Vulnerable Pedestrian Crosswalk Extension
 */
exports.updatePedestrians = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    const { approach = 'NORTH', crosswalkOccupied = false, waitingPedestrians = 0, extendSeconds = 0 } = req.body;

    const updated = await DBStore.updatePedestrianSafety(junctionId, {
      approach,
      crosswalkOccupied,
      waitingPedestrians,
      extendSeconds,
      turningConflictSuppressed: crosswalkOccupied
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: `Junction ${junctionId} not found` });
    }

    res.json({
      success: true,
      message: extendSeconds > 0
        ? `Pedestrian crossing safety extended by ${extendSeconds}s on ${approach} crosswalk`
        : `Pedestrian status updated for ${approach}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Server-Sent Events (SSE) live telemetry stream
 */
exports.getRealtimeStream = async (req, res, next) => {
  try {
    const { junctionId } = req.params;
    if (!isValidId(junctionId)) {
      return res.status(400).json({ success: false, message: 'Invalid junctionId' });
    }

    const initial = await DBStore.getJunctionById(junctionId);
    if (!initial) {
      return res.status(404).json({ success: false, message: 'Junction not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'SNAPSHOT', data: initial, timestamp: new Date().toISOString() })}\n\n`);

    const intervalId = setInterval(async () => {
      try {
        const current = await DBStore.getJunctionById(junctionId);
        if (current) {
          const activeApp = current.approaches.find(a => a.direction === current.activeDirection);
          if (activeApp && activeApp.remainingSeconds > 0) {
            activeApp.remainingSeconds -= 1;
          }
          res.write(`data: ${JSON.stringify({ type: 'TICK', data: current, timestamp: new Date().toISOString() })}\n\n`);
        }
      } catch (streamErr) {
        // Stream write error
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
  } catch (err) {
    next(err);
  }
};
