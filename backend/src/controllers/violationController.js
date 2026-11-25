const DBStore = require('../services/dbStore');

// GET /api/violations - List traffic violations with filters
exports.getViolations = async (req, res, next) => {
  try {
    const { junctionId, violationType, reviewStatus, limit } = req.query;
    const violations = await DBStore.getViolations({ junctionId, violationType, reviewStatus, limit });
    res.json({ success: true, count: violations.length, data: violations });
  } catch (err) {
    next(err);
  }
};

// POST /api/violations - Record violation from AI detection
exports.recordViolation = async (req, res, next) => {
  try {
    const {
      violationType,
      junctionId,
      roadId,
      cameraId,
      approach,
      vehicleTrackId,
      vehicleClass,
      plateNumber,
      plateConfidence,
      measuredSpeedKmh,
      speedLimitKmh,
      evidenceImageUrl,
      plateCropUrl,
      confidence,
      fineAmountInr
    } = req.body;

    if (!violationType || !junctionId || !vehicleTrackId) {
      return res.status(400).json({
        success: false,
        message: 'violationType, junctionId, and vehicleTrackId are required'
      });
    }

    const cleanPlate = (plateNumber || 'UNKNOWN').toUpperCase();
    const isIndianValid = DBStore.validateIndianPlate(cleanPlate);

    const violation = await DBStore.createViolation({
      violationType,
      junctionId,
      roadId: roadId || 'ROAD001',
      cameraId: cameraId || '',
      approach: approach || 'NORTH',
      vehicleTrackId,
      vehicleClass: vehicleClass || 'car',
      plateNumber: cleanPlate,
      plateConfidence: plateConfidence || 0.88,
      isPlateFormatValidIndian: isIndianValid,
      measuredSpeedKmh: measuredSpeedKmh || 0.0,
      speedLimitKmh: speedLimitKmh || 50.0,
      evidenceImageUrl: evidenceImageUrl || '',
      plateCropUrl: plateCropUrl || '',
      confidence: confidence || 0.90,
      fineAmountInr: fineAmountInr || (violationType === 'RED_LIGHT_JUMP' ? 2000 : 1000)
    });

    res.status(201).json({
      success: true,
      message: `Traffic violation logged: ${violationType}. E-Challan #${violation.eChallanNumber} issued.`,
      data: violation
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/violations/:violationId/review - Review status workflow
exports.reviewViolation = async (req, res, next) => {
  try {
    const { violationId } = req.params;
    const { reviewStatus, reviewedBy, notes } = req.body;

    if (!['VERIFIED', 'REJECTED', 'FALSE_POSITIVE', 'CLOSED'].includes(reviewStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid reviewStatus value' });
    }

    const updated = await DBStore.updateViolationReview(violationId, { reviewStatus, reviewedBy, notes });
    if (!updated) {
      return res.status(404).json({ success: false, message: `Violation ${violationId} not found` });
    }

    res.json({
      success: true,
      message: `Violation ${violationId} review updated to ${reviewStatus}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
