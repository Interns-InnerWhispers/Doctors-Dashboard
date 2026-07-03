const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const { reportController } = require('../controllers');
const upload = require('../services/uploadMiddleware');

// GET all reports (paginated)
router.get('/', middleware.authMiddleware, reportController.getReports);

// GET report by ID
router.get('/:id', middleware.authMiddleware, reportController.getReportById);

// CREATE report
router.post('/', middleware.authMiddleware, reportController.createReport);

// UPLOAD report file (PDF/image)
router.post(
  '/upload',
  middleware.authMiddleware,
  upload.single('file'),
  reportController.uploadReport
);

// UPDATE report
router.put('/:id', middleware.authMiddleware, reportController.updateReport);

// DELETE report
router.delete('/:id', middleware.authMiddleware, reportController.deleteReport);

module.exports = router;
