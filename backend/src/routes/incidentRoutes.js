const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');

router.get('/', incidentController.getIncidents);
router.post('/', incidentController.reportIncident);
router.get('/officers/nearby', incidentController.getNearbyOfficers);
router.get('/:incidentId', incidentController.getIncidentById);
router.post('/:incidentId/verify', incidentController.verifyAndDispatch);
router.post('/:incidentId/false-positive', incidentController.markFalsePositive);

module.exports = router;
