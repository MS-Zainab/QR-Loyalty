const express = require('express');

const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticates a user using email and password and returns a Supabase access token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@qrloyalty.local
 *               password:
 *                 type: string
 *                 format: password
 *                 example: QRLoyaltyTest123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid email or password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the currently authenticated user's Supabase account and profile information.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: User profile is not found or account is not active
 */
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    user: req.user,
    profile: req.profile
  });
});

/**
 * @swagger
 * /api/auth/test-role:
 *   get:
 *     summary: Test customer role authorization
 *     description: Verifies that the authenticated user has the customer role.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer role authorization successful
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: User does not have the customer role
 */
router.get(
  '/test-role',
  requireAuth,
  requireRole('customer'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Role authorization successful',
      role: req.profile.role
    });
  }
);

/**
 * @swagger
 * /api/auth/test-admin:
 *   get:
 *     summary: Test admin role authorization
 *     description: Verifies that the authenticated user has the admin role.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin authorization successful
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: User does not have the admin role
 */
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