const express = require('express');
const router = express.Router();
const { patientController } = require('../controllers');
const { authMiddleware, authorize, asyncHandler } = require('../middleware');

// Patient routes
router.get('/', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.getPatients));
router.post('/', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.createPatient));
router.get('/:id', authMiddleware, asyncHandler(patientController.getPatientById));
router.put('/profile', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.upsertPatientProfile));
router.put('/:id', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.updatePatientById));
router.delete('/:id', authMiddleware, authorize(['doctor', 'admin']), asyncHandler(patientController.deletePatientById));

module.exports = router;
