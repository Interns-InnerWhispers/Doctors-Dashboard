const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { authMiddleware, asyncHandler } = require('../middleware');

// Authentication routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/profile', authMiddleware, asyncHandler(authController.getProfile));

module.exports = router;
