const express = require("express");
const router = express.Router();
const upload = require("../services/uploadMiddleware");

const middleware = require("../middleware");
const { documentController } = require("../controllers");

// GET all documents
router.get(
  "/",
  middleware.authMiddleware,
  documentController.getDocuments
);

// GET document by ID
router.get(
  "/:id",
  middleware.authMiddleware,
  documentController.getDocumentById
);

// UPLOAD document
router.post(
  "/",
  middleware.authMiddleware,
  upload.single("file"),
  documentController.uploadDocument
);

// UPDATE document
router.put(
  "/:id",
  middleware.authMiddleware,
  documentController.updateDocument
);

// DELETE document
router.delete(
  "/:id",
  middleware.authMiddleware,
  documentController.deleteDocument
);

module.exports = router;