const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const { reportController } = require('../controllers');
const upload = require('../services/uploadMiddleware');

// GET all reports
router.get('/', middleware.authMiddleware, reportController.getReports);

// GET report by ID
router.get('/:id');

// CREATE report
router.post(
  "/upload",
  middleware.authMiddleware,
  upload.single("file"),
  reportController.uploadReport
);

// UPDATE report
router.put(
  '/:id',
  middleware.authMiddleware, reportController.updateReport
);

// DELETE report
router.delete('/:id');

module.exports = router;