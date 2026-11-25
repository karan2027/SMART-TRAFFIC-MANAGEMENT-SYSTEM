const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');

router.get('/', cameraController.getCameras);
router.post('/', cameraController.createCamera);
router.get('/:cameraId', cameraController.getCameraById);
router.put('/:cameraId', cameraController.updateCamera);
router.delete('/:cameraId', cameraController.deleteCamera);
router.post('/:cameraId/test', cameraController.testConnection);
router.post('/:cameraId/reconnect', cameraController.reconnectCamera);

module.exports = router;
