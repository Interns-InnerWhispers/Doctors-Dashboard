// BD-02 Session Notes CRUD Routes

const express = require("express");
const router = express.Router();
const { sessionController } = require("../controllers");
const { authMiddleware, asyncHandler } = require("../middleware");

router.get("/", authMiddleware, asyncHandler(sessionController.getSessions));

router.get("/:id", authMiddleware, asyncHandler(sessionController.getSessionById));

router.post("/", authMiddleware, asyncHandler(sessionController.createSession));

router.put("/:id", authMiddleware, asyncHandler(sessionController.updateSession));

router.delete("/:id", authMiddleware, asyncHandler(sessionController.deleteSession));

module.exports = router;