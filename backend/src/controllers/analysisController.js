const path = require('path');
const fs = require('fs');
const DBStore = require('../services/dbStore');
const AIService = require('../services/aiService');

exports.getJobs = async (req, res, next) => {
  try {
    const jobs = await DBStore.getJobs();
    res.json({ success: true, count: jobs.length, data: jobs });
  } catch (err) {
    next(err);
  }
};

exports.getJobById = async (req, res, next) => {
  try {
    const job = await DBStore.getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: `Job not found with ID ${req.params.jobId}`, errorCode: 'JOB_NOT_FOUND' });
    }
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

exports.startAnalysis = async (req, res, next) => {
  try {
    let { videoPath, cameraId = 'CAM001', roadId = 'ROAD001' } = req.body;

    if (!videoPath || typeof videoPath !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid videoPath is required', errorCode: 'MISSING_VIDEO_PATH' });
    }

    // Security: Strict validation of identifiers against injection
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roadId) || !/^[a-zA-Z0-9_-]{1,64}$/.test(cameraId)) {
      return res.status(400).json({ success: false, message: 'Invalid roadId or cameraId format', errorCode: 'INVALID_ID' });
    }

    const videosBaseDir = path.resolve(__dirname, '../../../data/videos');
    const resolvedPath = path.isAbsolute(videoPath)
      ? path.resolve(videoPath)
      : path.resolve(videosBaseDir, videoPath);

    // Security: Strict directory boundary check to prevent path traversal
    if (!resolvedPath.startsWith(videosBaseDir)) {
      return res.status(403).json({
        success: false,
        message: 'Security policy violation: videoPath must reside within the authorized data/videos repository',
        errorCode: 'FORBIDDEN_PATH'
      });
    }

    const allowedExts = ['.mp4', '.avi', '.mov', '.mkv'];
    const fileExt = path.extname(resolvedPath).toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported video file format (${fileExt}). Allowed formats: ${allowedExts.join(', ')}`,
        errorCode: 'INVALID_FORMAT'
      });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: `Video file not found: ${path.basename(resolvedPath)}`,
        errorCode: 'VIDEO_NOT_FOUND'
      });
    }

    // Ensure Road & Camera exist
    let road = await DBStore.getRoadById(roadId);
    if (!road) {
      road = await DBStore.createRoad({ roadId, name: `Main Road ${roadId}`, description: 'Auto-created during analysis' });
    }
    let camera = await DBStore.getCameraById(cameraId);
    if (!camera) {
      camera = await DBStore.createCamera({ cameraId, name: `Camera ${cameraId}`, roadId, sourcePath: resolvedPath });
    }

    const jobId = `JOB_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const job = await DBStore.createJob({
      jobId,
      videoPath: resolvedPath,
      videoFilename: path.basename(resolvedPath),
      cameraId,
      roadId,
      status: 'processing',
      stageMessage: 'Initializing AI computer vision pipeline...',
      startedAt: new Date()
    });

    res.status(202).json({
      success: true,
      message: 'Analysis job started',
      data: job
    });

    // Run AI processing asynchronously
    (async () => {
      try {
        const onProgress = async (progData) => {
          try {
            await DBStore.updateJob(jobId, {
              progress: typeof progData.progress === 'number' ? progData.progress : 0,
              stageMessage: progData.stage || 'Processing video frames...',
              currentFrame: progData.frame || 0,
              totalFrames: progData.total || 0
            });
          } catch (e) {
            console.warn(`[BACKEND] Error updating job progress for ${jobId}:`, e.message);
          }
        };

        const result = await AIService.runAnalysis({
          jobId,
          videoPath: resolvedPath,
          cameraId,
          roadId,
          progressCallback: onProgress
        });

        // Save aggregated readings
        if (result && result.readings && Array.isArray(result.readings)) {
          const corridorCounts = result.vehicles?.corridorMonitored || {
            total: result.vehicles?.total || 0,
            cars: result.vehicles?.cars || 0,
            motorcycles: result.vehicles?.motorcycles || 0,
            buses: result.vehicles?.buses || 0,
            trucks: result.vehicles?.trucks || 0
          };

          const docReadings = result.readings.map(r => ({
            jobId,
            cameraId,
            roadId,
            timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
            vehicleCounts: {
              total: r.cumulativeCounts ? r.cumulativeCounts.total : result.vehicles.total,
              cars: r.cumulativeCounts ? r.cumulativeCounts.car : result.vehicles.cars,
              motorcycles: r.cumulativeCounts ? r.cumulativeCounts.motorcycle : result.vehicles.motorcycles,
              buses: r.cumulativeCounts ? r.cumulativeCounts.bus : result.vehicles.buses,
              trucks: r.cumulativeCounts ? r.cumulativeCounts.truck : result.vehicles.trucks
            },
            corridorCounts: {
              total: r.uniqueMonitoredCorridor || corridorCounts.total,
              cars: corridorCounts.cars,
              motorcycles: corridorCounts.motorcycles,
              buses: corridorCounts.buses,
              trucks: corridorCounts.trucks
            },
            activeInRoi: r.activeInRoi !== undefined ? r.activeInRoi : (result.vehicles?.averageRoiDensity || 0),
            stationaryCount: r.stationaryInRoi !== undefined ? r.stationaryInRoi : (result.vehicles?.stationaryVehiclesCount || 0),
            averageSpeedKmh: r.average_speed_kmh || result.traffic.averageSpeedKmh,
            trafficFlowVehiclesPerHour: r.traffic_flow_vph || result.traffic.averageFlowVehiclesPerHour,
            densityLevel: r.density_level || result.traffic.densityLevel,
            congestionLevel: r.congestion_level || result.traffic.congestionLevel,
            directionData: r.directionCounts || { directionA: 0, directionB: 0 },
            source: 'video',
            analysisVersion: '1.0.0'
          }));

          await DBStore.insertReadings(docReadings);
          console.log(`[BACKEND] Saved ${docReadings.length} traffic readings to Database Store for Job ${jobId}`);
        }

        await DBStore.updateJob(jobId, {
          status: 'completed',
          progress: 100,
          stageMessage: 'Analysis completed successfully',
          resultSummary: result,
          completedAt: new Date()
        });

      } catch (err) {
        console.error(`[BACKEND ERROR] Analysis job ${jobId} failed: ${err.message}`);
        await DBStore.updateJob(jobId, {
          status: 'failed',
          stageMessage: 'Analysis job failed',
          errorMessage: err.message
        });
      }
    })();

  } catch (err) {
    next(err);
  }
};

exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file uploaded', errorCode: 'NO_FILE' });
    }

    const videoPath = req.file.path;
    const { cameraId = 'CAM001', roadId = 'ROAD001' } = req.body;

    req.body.videoPath = videoPath;
    return exports.startAnalysis(req, res, next);
  } catch (err) {
    next(err);
  }
};
