const express = require("express");
const router = express.Router();

// GET all documents
router.get("/");

// GET document by ID
router.get("/:id");

// UPLOAD document
router.post("/");

// UPDATE document
router.put("/:id");

// DELETE document
router.delete("/:id");

module.exports = router;
