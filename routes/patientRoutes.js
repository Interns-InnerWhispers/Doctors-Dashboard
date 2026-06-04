const express = require('express');
const router = express.Router();
const { patientController } = require('../controllers');
const { authMiddleware, authorize, asyncHandler } = require('../middleware');

// Patient routes
router.get('/', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.getPatients));
router.get('/:id', authMiddleware, asyncHandler(patientController.getPatientById));
router.put('/profile', authMiddleware, authorize('patient'), asyncHandler(patientController.upsertPatientProfile));

module.exports = router;
