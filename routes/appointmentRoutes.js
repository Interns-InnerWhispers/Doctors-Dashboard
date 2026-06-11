const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const { appointmentController } = require('../controllers');

// GET
router.get('/', middleware.authMiddleware, appointmentController.getAppointments);

// POST
router.post('/', middleware.authMiddleware, appointmentController.createAppointment);

// PUT
router.put('/:id', middleware.authMiddleware, appointmentController.updateAppointment);

module.exports = router;