const DBStore = require('../services/dbStore');

// Security helper: Validate alphanumeric identifier
const isValidId = (val) => typeof val === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(val);

exports.getReadings = async (req, res, next) => {
  try {
    let { roadId, cameraId, start, end, limit = 100 } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (start && (typeof start !== 'string' || isNaN(Date.parse(start)))) {
      return res.status(400).json({ success: false, message: 'Invalid start date format (ISO expected)', errorCode: 'INVALID_PARAM' });
    }
    if (end && (typeof end !== 'string' || isNaN(Date.parse(end)))) {
      return res.status(400).json({ success: false, message: 'Invalid end date format (ISO expected)', errorCode: 'INVALID_PARAM' });
    }

    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

    const readings = await DBStore.getReadings({ roadId, cameraId, start, end, limit: parsedLimit });
    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) {
    next(err);
  }
};

exports.getLatestReading = async (req, res, next) => {
  try {
    const { roadId, cameraId } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }

    const latest = await DBStore.getLatestReading({ roadId, cameraId });
    if (!latest) {
      return res.status(404).json({ success: false, message: 'No traffic readings found', errorCode: 'NO_READINGS' });
    }
    res.json({ success: true, data: latest });
  } catch (err) {
    next(err);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const { roadId, cameraId } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }

    const readings = await DBStore.getReadings({ roadId, cameraId, limit: 50 });

    if (readings.length === 0) {
      return res.json({
        success: true,
        data: {
          totalVehicles: 0,
          vehicleCounts: { cars: 0, motorcycles: 0, buses: 0, trucks: 0 },
          averageSpeedKmh: 0,
          averageFlowVehiclesPerHour: 0,
          currentDensity: 'LOW',
          currentCongestion: 'LOW',
          readingsCount: 0
        }
      });
    }

    const latest = readings[readings.length - 1];
    const totalVehicles = latest.vehicleCounts?.total || 0;
    const cars = latest.vehicleCounts?.cars || 0;
    const motorcycles = latest.vehicleCounts?.motorcycles || 0;
    const buses = latest.vehicleCounts?.buses || 0;
    const trucks = latest.vehicleCounts?.trucks || 0;

    const corridorTotal = latest.corridorCounts?.total || totalVehicles;
    const corridorCounts = latest.corridorCounts || latest.vehicleCounts;
    const stationaryVehicles = latest.stationaryCount || 0;
    const activeInRoi = latest.activeInRoi || 0;

    const avgSpeed = readings.reduce((acc, r) => acc + (r.averageSpeedKmh || 0), 0) / readings.length;
    const avgFlow = readings.reduce((acc, r) => acc + (r.trafficFlowVehiclesPerHour || 0), 0) / readings.length;

    res.json({
      success: true,
      data: {
        totalVehicles,
        corridorVehicles: corridorTotal,
        corridorCounts,
        lineCrossings: { total: totalVehicles, cars, motorcycles, buses, trucks },
        stationaryVehicles,
        activeInRoi,
        vehicleCounts: { cars, motorcycles, buses, trucks },
        averageSpeedKmh: Math.round(avgSpeed * 10) / 10,
        averageFlowVehiclesPerHour: Math.round(avgFlow * 10) / 10,
        currentDensity: latest.densityLevel || 'LOW',
        currentCongestion: latest.congestionLevel || 'LOW',
        readingsCount: readings.length
      }
    });
  } catch (err) {
    next(err);
  }
};
