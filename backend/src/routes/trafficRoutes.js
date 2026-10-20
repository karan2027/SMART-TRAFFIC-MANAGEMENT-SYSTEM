const express = require('express');
const router = express.Router();
const trafficController = require('../controllers/trafficController');

router.get('/readings', trafficController.getReadings);
router.get('/latest', trafficController.getLatestReading);
router.get('/summary', trafficController.getSummary);

module.exports = router;
