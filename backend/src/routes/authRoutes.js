const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    user: req.user,
    profile: req.profile
  });
});

router.get('/test-role', requireAuth, requireRole('customer'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Role authorization successful',
    role: req.profile.role
  });
});

router.get(
  '/test-admin',
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Admin authorization successful',
      role: req.profile.role
    });
  }
);

module.exports = router;