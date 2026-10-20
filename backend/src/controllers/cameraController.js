const DBStore = require('../services/dbStore');

exports.getCameras = async (req, res, next) => {
  try {
    const cameras = await DBStore.getCameras(req.query.roadId);
    res.json({ success: true, count: cameras.length, data: cameras });
  } catch (err) {
    next(err);
  }
};

exports.getCameraById = async (req, res, next) => {
  try {
    const camera = await DBStore.getCameraById(req.params.cameraId);
    if (!camera) {
      return res.status(404).json({ success: false, message: `Camera not found with ID ${req.params.cameraId}`, errorCode: 'CAMERA_NOT_FOUND' });
    }
    res.json({ success: true, data: camera });
  } catch (err) {
    next(err);
  }
};

exports.createCamera = async (req, res, next) => {
  try {
    const { cameraId, name, roadId, location, sourceType, sourcePath, resolution, fps } = req.body;
    let camera = await DBStore.getCameraById(cameraId);
    if (camera) {
      return res.status(400).json({ success: false, message: `Camera ID ${cameraId} already exists`, errorCode: 'DUPLICATE_CAMERA' });
    }

    camera = await DBStore.createCamera({
      cameraId,
      name,
      roadId,
      location,
      sourceType: sourceType || 'recorded_video',
      sourcePath: sourcePath || '',
      resolution: resolution || { width: 1280, height: 720 },
      fps: fps || 30
    });

    res.status(201).json({ success: true, data: camera });
  } catch (err) {
    next(err);
  }
};
