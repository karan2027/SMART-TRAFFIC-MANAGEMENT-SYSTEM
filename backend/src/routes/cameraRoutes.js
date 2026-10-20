const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');

router.get('/', cameraController.getCameras);
router.get('/:cameraId', cameraController.getCameraById);
router.post('/', cameraController.createCamera);

module.exports = router;
