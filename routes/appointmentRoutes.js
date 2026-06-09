const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const { appointmentController } = require('../controllers');

// GET /api/appointments - list with filters
router.get('/', middleware.authMiddleware, appointmentController.getAppointments);

module.exports = router;
