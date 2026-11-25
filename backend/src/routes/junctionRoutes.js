const express = require('express');
const router = express.Router();
const junctionController = require('../controllers/junctionController');

router.get('/', junctionController.getJunctions);
router.post('/', junctionController.createJunction);
router.get('/:junctionId', junctionController.getJunctionById);
router.put('/:junctionId/phase', junctionController.updateSignalPhase);
router.post('/:junctionId/emergency', junctionController.triggerEmergencyOverride);
router.post('/:junctionId/emergency/clear', junctionController.clearEmergencyOverride);
router.get('/:junctionId/spat', junctionController.getSpatCountdown);
router.post('/:junctionId/pedestrians', junctionController.updatePedestrians);
router.get('/:junctionId/stream', junctionController.getRealtimeStream);

module.exports = router;
