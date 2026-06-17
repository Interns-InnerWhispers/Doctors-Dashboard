const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const { reportController } = require('../controllers');

// GET all reports
router.get('/', middleware.authMiddleware, reportController.getReports);

// GET report by ID
router.get('/:id');

// CREATE report
router.post(
  '/',
  middleware.authMiddleware,
  reportController.createReport
);

// UPDATE report
router.put('/:id');

// DELETE report
router.delete('/:id');

module.exports = router;