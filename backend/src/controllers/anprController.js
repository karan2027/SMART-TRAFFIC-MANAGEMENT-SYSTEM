const DBStore = require('../services/dbStore');

// GET /api/anpr - List ANPR records
exports.getANPRRecords = async (req, res, next) => {
  try {
    const { plateNumber, limit } = req.query;
    const records = await DBStore.getANPRRecords({ plateNumber, limit });
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

// POST /api/anpr - Ingest ANPR plate reading
exports.recordPlate = async (req, res, next) => {
  try {
    const {
      plateText,
      ocrConfidence,
      vehicleTrackId,
      vehicleClass,
      cameraId,
      roadId,
      junctionId,
      cropImageUrl,
      sceneImageUrl
    } = req.body;

    if (!plateText || typeof ocrConfidence !== 'number' || !vehicleTrackId) {
      return res.status(400).json({
        success: false,
        message: 'plateText, ocrConfidence, and vehicleTrackId are required'
      });
    }

    const clean = plateText.trim().toUpperCase();
    const isFormatValid = DBStore.validateIndianPlate(clean);
    const stateCode = isFormatValid ? clean.substring(0, 2) : '';
    const rtoCode = isFormatValid ? clean.substring(2, 4) : '';

    const record = await DBStore.createANPRRecord({
      plateText: clean,
      ocrConfidence,
      isFormatValid,
      stateCode,
      rtoCode,
      vehicleTrackId,
      vehicleClass: vehicleClass || 'car',
      cameraId: cameraId || 'CAM001',
      roadId: roadId || 'ROAD001',
      junctionId: junctionId || 'JUNC001',
      cropImageUrl: cropImageUrl || '',
      sceneImageUrl: sceneImageUrl || ''
    });

    res.status(201).json({
      success: true,
      message: `ANPR Plate logged: ${clean} (Indian Format Valid: ${isFormatValid})`,
      data: record
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/anpr/validate - Quick plate format validator tester
exports.validatePlateFormat = async (req, res, next) => {
  try {
    const plate = req.query.plate || '';
    const isValid = DBStore.validateIndianPlate(plate);
    res.json({
      success: true,
      plate: plate.toUpperCase(),
      isValidIndianRegistration: isValid,
      standardFormat: '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$ (e.g. DL01CA1234, MH12AB9876)'
    });
  } catch (err) {
    next(err);
  }
};
