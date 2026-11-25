const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.get('/environmental', telemetryController.getEnvironmental);
router.post('/environmental', telemetryController.recordEnvironmental);
router.get('/system-health', telemetryController.getSystemHealth);

module.exports = router;
