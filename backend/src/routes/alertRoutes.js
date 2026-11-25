const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getAlerts);
router.post('/', alertController.createAlert);
router.get('/stream', alertController.streamAlerts);
router.put('/:alertId/acknowledge', alertController.acknowledgeAlert);
router.put('/:alertId/resolve', alertController.resolveAlert);

module.exports = router;
