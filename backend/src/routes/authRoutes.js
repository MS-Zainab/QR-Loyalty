const express = require('express');

const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { createRateLimiter } = require('../middleware/rateLimit');

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
 *                 example: ''
 *               password:
 *                 type: string
 *                 format: password
 *                 example: ''
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
router.post(
  '/login',
  createRateLimiter({
    limit: 5,
    windowMs: 15 * 60_000,
    keyFor: (req) => req.ip || 'unknown'
  }),
  async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      email.length > 254 ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 1024
    ) {
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
  }
);

/**
 * @swagger
 * /api/auth/customer-login:
 *   post:
 *     summary: Fast Customer Login via Name and Phone
 *     description: Authenticates or registers a customer using Full Name and Phone Number.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *               - phone_number
 *             properties:
 *               full_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer login successful
 *       400:
 *         description: Missing or invalid credentials
 *       500:
 *         description: Authentication failed
 */
router.post(
  '/customer-login',
  createRateLimiter({
    limit: 10,
    windowMs: 15 * 60_000,
    keyFor: (req) => req.ip || 'unknown'
  }),
  async (req, res) => {
    try {
      const { full_name, phone_number } = req.body || {};

      if (!full_name || !full_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Full name is required'
        });
      }

      if (!phone_number || !phone_number.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const cleanPhone = phone_number.replace(/[^\d+]/g, '');
      if (cleanPhone.length < 7) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number (at least 7 digits)'
        });
      }

      const formattedName = full_name.trim();
      const customerEmail = `cust_${cleanPhone.replace('+', '')}@qrloyalty.local`;
      const customerPassword = `Customer_${cleanPhone.replace('+', '')}_Pass!`;

      // Check if user already exists in auth
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: customerEmail,
        password: customerPassword
      });

      if (existingUser && existingUser.session) {
        // Retrieve profile
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('auth_user_id', existingUser.user.id)
          .maybeSingle();

        return res.status(200).json({
          success: true,
          message: 'Customer authenticated successfully',
          access_token: existingUser.session.access_token,
          refresh_token: existingUser.session.refresh_token,
          user: existingUser.user,
          profile: profile || {
            id: existingUser.user.id,
            full_name: formattedName,
            role: 'customer',
            status: 'active'
          }
        });
      }

      // Create new customer account in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: customerEmail,
        password: customerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: formattedName,
          phone: cleanPhone,
          role: 'customer'
        }
      });

      if (authError || !authData?.user) {
        console.error('Customer auth creation error:', authError);
        return res.status(500).json({
          success: false,
          message: authError?.message || 'Failed to authenticate customer'
        });
      }

      // Create profile record
      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          auth_user_id: authData.user.id,
          full_name: formattedName,
          role: 'customer',
          status: 'active'
        })
        .select('*')
        .single();

      if (profileError) {
        console.error('Customer profile creation error:', profileError);
      }

      // Sign in to get session tokens
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email: customerEmail,
        password: customerPassword
      });

      if (sessionError || !sessionData?.session) {
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize customer session'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Customer registered and authenticated successfully',
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user: sessionData.user,
        profile: newProfile || {
          id: authData.user.id,
          full_name: formattedName,
          role: 'customer',
          status: 'active'
        }
      });
    } catch (error) {
      console.error('Customer login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Customer authentication failed'
      });
    }
  }
);

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

/**
 * @swagger
 * /api/auth/reset-password-request:
 *   post:
 *     summary: Request a password reset
 *     description: Submits a password reset request for a tenant or vendor staff.
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
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request submitted successfully
 *       400:
 *         description: Email and role are required
 *       500:
 *         description: Internal server error
 */
router.post('/reset-password-request', async (req, res) => {
  try {
    const { email, role } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    const { error } = await supabaseAdmin
      .from('password_reset_requests')
      .insert({
        email: email.trim().toLowerCase(),
        role: role.trim()
      });

    if (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit password reset request'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset request submitted successfully'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit password reset request'
    });
  }
});

module.exports = router;
