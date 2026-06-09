const express = require("express");
const router = express.Router();

// GET all session notes
router.get("/");

// GET session note by ID
router.get("/:id");

// CREATE session note
router.post("/");

// UPDATE session note
router.put("/:id");

// DELETE session note
router.delete("/:id");

module.exports = router;
