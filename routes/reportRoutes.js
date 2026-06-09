const express = require("express");
const router = express.Router();

// GET all reports
router.get("/");

// GET report by ID
router.get("/:id");

// CREATE report
router.post("/");

// UPDATE report
router.put("/:id");

// DELETE report
router.delete("/:id");

module.exports = router;
