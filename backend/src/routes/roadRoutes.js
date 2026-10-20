const express = require('express');
const router = express.Router();
const roadController = require('../controllers/roadController');

router.get('/', roadController.getRoads);
router.get('/:roadId', roadController.getRoadById);
router.post('/', roadController.createRoad);

module.exports = router;
