const DBStore = require('../services/dbStore');

// Security helper: Validate alphanumeric identifier
const isValidId = (val) => typeof val === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(val);

exports.getReadings = async (req, res, next) => {
  try {
    let { roadId, cameraId, jobId, start, end, limit = 100 } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (jobId && !isValidId(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid jobId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (start && (typeof start !== 'string' || isNaN(Date.parse(start)))) {
      return res.status(400).json({ success: false, message: 'Invalid start date format (ISO expected)', errorCode: 'INVALID_PARAM' });
    }
    if (end && (typeof end !== 'string' || isNaN(Date.parse(end)))) {
      return res.status(400).json({ success: false, message: 'Invalid end date format (ISO expected)', errorCode: 'INVALID_PARAM' });
    }

    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

    const readings = await DBStore.getReadings({ roadId, cameraId, jobId, start, end, limit: parsedLimit });
    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) {
    next(err);
  }
};

exports.getLatestReading = async (req, res, next) => {
  try {
    const { roadId, cameraId, jobId } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (jobId && !isValidId(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid jobId parameter format', errorCode: 'INVALID_PARAM' });
    }

    const latest = await DBStore.getLatestReading({ roadId, cameraId, jobId });
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
    const { roadId, cameraId, jobId } = req.query;

    if (roadId && !isValidId(roadId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (cameraId && !isValidId(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid cameraId parameter format', errorCode: 'INVALID_PARAM' });
    }
    if (jobId && !isValidId(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid jobId parameter format', errorCode: 'INVALID_PARAM' });
    }

    // 1. Authoritative metrics from latest completed AI analysis job
    const completedJob = await DBStore.getLatestCompletedJob({ roadId, cameraId, jobId });

    if (completedJob && completedJob.resultSummary) {
      const sum = completedJob.resultSummary;
      const lineCrossings = sum.vehicles?.lineCrossings || {
        total: sum.vehicles?.total || 0,
        cars: sum.vehicles?.cars || 0,
        motorcycles: sum.vehicles?.motorcycles || 0,
        buses: sum.vehicles?.buses || 0,
        trucks: sum.vehicles?.trucks || 0
      };

      const corridorCounts = sum.vehicles?.corridorMonitored || {
        total: sum.vehicles?.uniqueMonitoredTotal || lineCrossings.total,
        cars: lineCrossings.cars,
        motorcycles: lineCrossings.motorcycles,
        buses: lineCrossings.buses,
        trucks: lineCrossings.trucks
      };

      return res.json({
        success: true,
        data: {
          jobId: completedJob.jobId,
          totalVehicles: lineCrossings.total,
          corridorVehicles: corridorCounts.total,
          corridorCounts: {
            total: corridorCounts.total,
            cars: corridorCounts.cars || 0,
            motorcycles: corridorCounts.motorcycles || 0,
            buses: corridorCounts.buses || 0,
            trucks: corridorCounts.trucks || 0
          },
          lineCrossings: {
            total: lineCrossings.total,
            cars: lineCrossings.cars || 0,
            motorcycles: lineCrossings.motorcycles || 0,
            buses: lineCrossings.buses || 0,
            trucks: lineCrossings.trucks || 0
          },
          stationaryVehicles: sum.vehicles?.stationaryVehiclesCount ?? sum.traffic?.stationaryCount ?? 0,
          activeInRoi: sum.vehicles?.averageRoiDensity ?? sum.traffic?.averageRoiDensity ?? 0,
          vehicleCounts: {
            cars: lineCrossings.cars || 0,
            motorcycles: lineCrossings.motorcycles || 0,
            buses: lineCrossings.buses || 0,
            trucks: lineCrossings.trucks || 0
          },
          averageSpeedKmh: sum.traffic?.averageSpeedKmh || 0,
          averageFlowVehiclesPerHour: sum.traffic?.averageFlowVehiclesPerHour || 0,
          currentDensity: sum.traffic?.densityLevel || 'LOW',
          currentCongestion: sum.traffic?.congestionLevel || 'LOW',
          readingsCount: sum.readings?.length || 0
        }
      });
    }

    // 2. Fallback to readings aggregation if no completed analysis job exists
    const readings = await DBStore.getReadings({ roadId, cameraId, jobId, limit: 50 });

    if (readings.length === 0) {
      return res.json({
        success: true,
        data: {
          totalVehicles: 0,
          corridorVehicles: 0,
          corridorCounts: { total: 0, cars: 0, motorcycles: 0, buses: 0, trucks: 0 },
          lineCrossings: { total: 0, cars: 0, motorcycles: 0, buses: 0, trucks: 0 },
          stationaryVehicles: 0,
          activeInRoi: 0,
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
    const corridorCounts = latest.corridorCounts || {
      total: corridorTotal,
      cars,
      motorcycles,
      buses,
      trucks
    };
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
