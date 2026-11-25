const express = require('express');
const router = express.Router();
const violationController = require('../controllers/violationController');

router.get('/', violationController.getViolations);
router.post('/', violationController.recordViolation);
router.put('/:violationId/review', violationController.reviewViolation);

module.exports = router;
