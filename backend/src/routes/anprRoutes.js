const express = require('express');
const router = express.Router();
const anprController = require('../controllers/anprController');

router.get('/', anprController.getANPRRecords);
router.post('/', anprController.recordPlate);
router.get('/validate', anprController.validatePlateFormat);

module.exports = router;
