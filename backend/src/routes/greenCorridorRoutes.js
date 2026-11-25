const express = require('express');
const router = express.Router();
const greenCorridorController = require('../controllers/greenCorridorController');

router.get('/', greenCorridorController.getCorridors);
router.post('/plan', greenCorridorController.planRoute);
router.post('/activate', greenCorridorController.activateCorridor);
router.post('/:corridorId/advance', greenCorridorController.advanceCorridor);

module.exports = router;
