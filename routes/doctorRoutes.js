const express = require('express');
const router = express.Router();
const { doctorController } = require('../controllers');
const { authMiddleware, authorize, asyncHandler } = require('../middleware');

// Doctor routes
router.get('/', asyncHandler(doctorController.getDoctors));
router.get('/:id', asyncHandler(doctorController.getDoctorById));
router.put('/profile', authMiddleware, authorize('doctor'), asyncHandler(doctorController.updateDoctorProfile));

module.exports = router;
