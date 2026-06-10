// BD-02 Session Notes CRUD Routes

const express = require("express");
const router = express.Router();

const { sessionController } = require("../controllers");

router.get("/", sessionController.getSessions);

router.get("/:id", sessionController.getSessionById);

router.post("/", sessionController.createSession);

router.put("/:id", sessionController.updateSession);

router.delete("/:id", sessionController.deleteSession);

module.exports = router;