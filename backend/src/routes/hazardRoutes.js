const express = require('express');
const router = express.Router();
const hazardController = require('../controllers/hazardController');

router.get('/', hazardController.getHazards);
router.post('/', hazardController.reportHazard);
router.post('/:hazardId/resolve', hazardController.resolveHazard);

module.exports = router;
