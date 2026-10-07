const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { isUuid } = require('../middleware/validation');
const supabaseAdmin = require('../config/supabaseAdmin');

/**
 * Generate a URL-friendly slug from business name, ensuring uniqueness.
 */
async function generateUniqueSlug(businessName) {
  // Lowercase, replace spaces/special chars with hyphens, remove invalid chars
  let baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  if (baseSlug.length < 2) {
    baseSlug = `tenant-${Date.now().toString(36)}`;
  }

  // Check uniqueness; append -2, -3, etc. if taken
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const { data: existing } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    const numbered = `${baseSlug}-${suffix}`;
    // Ensure we don't exceed 60 chars
    candidate = numbered.length <= 60 ? numbered : numbered.slice(0, 60).replace(/-$/, '');
  }
}

const router = express.Router();

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     summary: Create a new vendor
 *     description: Creates a new vendor/tenant. Only platform administrators can perform this action.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - business_name
 *             properties:
 *               business_name:
 *                 type: string
 *                 example: Loyalty Demo Cafe
 *     responses:
 *       201:
 *         description: Vendor created successfully
 *       400:
 *         description: Business name is required
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Server error while creating vendor
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { business_name, slug: providedSlug } = req.body;

      if (!business_name || !business_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business name is required'
        });
      }

      let finalSlug;

      // If admin provided a custom slug, validate and use it
      if (providedSlug && typeof providedSlug === 'string') {
        const trimmedSlug = providedSlug.trim();

        // Validate format
        if (!/^[a-z0-9-]{2,60}$/.test(trimmedSlug)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid slug format. Must be 2-60 characters with lowercase letters, digits, and hyphens only.'
          });
        }

        if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-')) {
          return res.status(400).json({
            success: false,
            message: 'Slug cannot start or end with a hyphen.'
          });
        }

        // Check uniqueness
        const { data: existing } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('slug', trimmedSlug)
          .maybeSingle();

        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'This slug is already in use by another vendor.'
          });
        }

        finalSlug = trimmedSlug;
      } else {
        // Auto-generate unique slug from business name as fallback
        finalSlug = await generateUniqueSlug(business_name.trim());
      }

      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .insert({
          business_name: business_name.trim(),
          status: 'active',
          slug: finalSlug
        })
        .select()
        .single();

      if (error) {
        console.error('Create tenant error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to create vendor'
        });
      }

      // Auto-generate business QR code for new vendor
      try {
        const crypto = require('crypto');
        const qrCodeValue = crypto.randomBytes(16).toString('hex');
        await supabaseAdmin.from('qr_codes').insert({
          tenant_id: tenant.id,
          code: qrCodeValue,
          is_active: true
        });
      } catch (qrErr) {
        console.error('Auto QR creation error on tenant onboard:', qrErr);
      }

      return res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        tenant,
        slug: tenant.slug
      });
    } catch (error) {
      console.error('Create tenant error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while creating vendor'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants:
 *   get:
 *     summary: Get all vendors
 *     description: Returns all vendors/tenants. Only platform administrators can access this endpoint.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendors fetched successfully
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Server error while fetching vendors
 */
router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status, created_at, updated_at, slug')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get tenants error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch vendors'
        });
      }

      return res.status(200).json({
        success: true,
        tenants
      });
    } catch (error) {
      console.error('Get tenants error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while fetching vendors'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants/{id}/status:
 *   patch:
 *     summary: Update vendor status
 *     description: Changes a vendor status between active, hold, and removed. Only platform administrators can perform this action.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor/tenant UUID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: 060992ac-2169-4a56-8feb-cb45040f6b24
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - hold
 *                   - removed
 *                 example: hold
 *     responses:
 *       200:
 *         description: Vendor status updated successfully
 *       400:
 *         description: Invalid vendor status
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Server error while updating vendor status
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!isUuid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid vendor ID is required'
        });
      }

      const allowedStatuses = ['active', 'hold', 'removed'];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid vendor status'
        });
      }

      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update tenant status error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to update vendor status'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Vendor status updated successfully',
        tenant
      });
    } catch (error) {
      console.error('Update tenant status error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while updating vendor status'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants/{id}/slug:
 *   patch:
 *     summary: Update tenant branded slug
 *     description: Allows platform administrators to set or update a tenant's branded slug for customer-facing URLs. Validates uniqueness and format.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor/tenant UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slug
 *             properties:
 *               slug:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 60
 *                 pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
 *                 example: test-cafe
 *     responses:
 *       200:
 *         description: Tenant slug updated successfully
 *       400:
 *         description: Invalid slug format or duplicate slug
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Tenant not found
 *       500:
 *         description: Server error while updating slug
 */
router.patch(
  '/:id/slug',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { slug } = req.body;

      if (!isUuid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid tenant ID is required'
        });
      }

      // Validate slug format
      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Slug is required'
        });
      }

      const trimmedSlug = slug.trim();

      // Check format: lowercase letters, digits, hyphens only, 2-60 chars
      if (!/^[a-z0-9-]{2,60}$/.test(trimmedSlug)) {
        return res.status(400).json({
          success: false,
          message: 'Slug must be 2-60 characters, containing only lowercase letters, digits, and hyphens'
        });
      }

      // Cannot start or end with hyphen
      if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-')) {
        return res.status(400).json({
          success: false,
          message: 'Slug cannot start or end with a hyphen'
        });
      }

      // Check uniqueness (excluding current tenant)
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', trimmedSlug)
        .neq('id', id)
        .maybeSingle();

      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'This slug is already in use by another vendor'
        });
      }

      // Update the tenant slug
      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .update({
          slug: trimmedSlug,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id, business_name, slug, status')
        .single();

      if (error) {
        console.error('Update tenant slug error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to update tenant slug'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Tenant slug updated successfully',
        tenant
      });
    } catch (error) {
      console.error('Update tenant slug error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while updating slug'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants/{id}/owner:
 *   post:
 *     summary: Create vendor owner
 *     description: Creates a Supabase Auth account and application profile for a vendor owner. Only platform administrators can perform this action.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor/tenant UUID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: 060992ac-2169-4a56-8feb-cb45040f6b24
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *               full_name:
 *                 type: string
 *                 example: Cafe Owner
 *     responses:
 *       201:
 *         description: Vendor owner created successfully
 *       400:
 *         description: Invalid request, weak password, inactive vendor, or Auth creation error
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error while creating vendor owner
 */
router.post(
  '/:id/owner',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id: tenantId } = req.params;
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({
          success: false,
          message: 'Email, password and full name are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      // Check that the tenant exists and is active
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      if (tenant.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Owner can only be created for an active vendor'
        });
      }

      // Create Supabase Auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

      if (authError) {
        console.error('Create owner auth error:', authError);

        return res.status(400).json({
          success: false,
          message: authError.message
        });
      }

      // Create the application profile and link it to the tenant
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          auth_user_id: authData.user.id,
          tenant_id: tenantId,
          full_name: full_name.trim(),
          role: 'vendor_owner',
          status: 'active'
        })
        .select('id, auth_user_id, tenant_id, full_name, role, status')
        .single();

      if (profileError) {
        console.error('Create owner profile error:', profileError);

        // Remove Auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

        return res.status(500).json({
          success: false,
          message: 'Failed to create owner profile'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Vendor owner created successfully',
        owner: profile,
        tenant: {
          id: tenant.id,
          business_name: tenant.business_name,
          status: tenant.status
        }
      });
    } catch (error) {
      console.error('Create vendor owner error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while creating vendor owner'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants/{id}/staff:
 *   post:
 *     summary: Create vendor staff member
 *     description: Creates a Supabase Auth account and application profile for vendor staff. Platform admins can create staff for any vendor, while vendor owners can create staff only for their own vendor.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor/tenant UUID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: 060992ac-2169-4a56-8feb-cb45040f6b24
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: staff@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *               full_name:
 *                 type: string
 *                 example: Counter Staff
 *     responses:
 *       201:
 *         description: Vendor staff created successfully
 *       400:
 *         description: Invalid request, weak password, inactive vendor, or Auth creation error
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: User is not authorized or vendor owner is managing another vendor
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error while creating vendor staff
 */
router.post(
  '/:id/staff',
  requireAuth,
  requireRole('admin', 'vendor_owner'),
  async (req, res) => {
    try {
      const { id: tenantId } = req.params;
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({
          success: false,
          message: 'Email, password and full name are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      // Check that the tenant exists and is active
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      if (tenant.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Staff can only be created for an active vendor'
        });
      }

      // Vendor owner can only create staff for their own vendor
      if (
        req.profile.role === 'vendor_owner' &&
        req.profile.tenant_id !== tenantId
      ) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage staff for your own vendor'
        });
      }

      // Create Supabase Auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

      if (authError) {
        console.error('Create staff auth error:', authError);

        return res.status(400).json({
          success: false,
          message: authError.message
        });
      }

      // Create staff profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          auth_user_id: authData.user.id,
          tenant_id: tenantId,
          full_name: full_name.trim(),
          role: 'vendor_staff',
          status: 'active'
        })
        .select('id, auth_user_id, tenant_id, full_name, role, status')
        .single();

      if (profileError) {
        console.error('Create staff profile error:', profileError);

        // Remove Auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

        return res.status(500).json({
          success: false,
          message: 'Failed to create staff profile'
        });
      }

      // Create staff table operational record. Without this row the staff
      // member cannot generate verification PINs, so a failure here must
      // roll back the whole creation instead of only logging.
      const { data: staffRecord, error: staffRecordError } = await supabaseAdmin
        .from('staff')
        .insert({
          tenant_id: tenantId,
          profile_id: profile.id,
          is_active: true
        })
        .select()
        .single();

      if (staffRecordError || !staffRecord) {
        console.error('Create staff table record error:', staffRecordError);

        // Roll back the profile and auth user so no half-created staff remains
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', profile.id)
          .catch(() => {});
        await supabaseAdmin.auth.admin
          .deleteUser(authData.user.id)
          .catch(() => {});

        return res.status(500).json({
          success: false,
          message: 'Failed to create staff operational record'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Vendor staff created successfully',
        staff: profile,
        staff_record: staffRecord || null,
        tenant: {
          id: tenant.id,
          business_name: tenant.business_name,
          status: tenant.status
        }
      });
    } catch (error) {
      console.error('Create vendor staff error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while creating vendor staff'
      });
    }
  }
);

/**
 * @swagger
 * /api/tenants/slug/{slug}:
 *   get:
 *     summary: Resolve tenant slug to active QR code
 *     description: Public endpoint. Looks up a tenant by its branded slug and returns the active QR code identifier so the customer verification page can be pre-filled. No authentication required.
 *     tags:
 *       - Tenants
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Tenant branded slug (e.g. coffee-house)
 *         schema:
 *           type: string
 *           example: coffee-house
 *     responses:
 *       200:
 *         description: Slug resolved successfully
 *       400:
 *         description: Invalid slug format
 *       404:
 *         description: Tenant or active QR code not found
 *       500:
 *         description: Server error
 */
router.get(
  '/slug/:slug',
  async (req, res) => {
    try {
      const { slug } = req.params;

      // Validate slug format: lowercase letters, digits, hyphens only, 2–60 chars
      if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid slug format'
        });
      }

      // Find active tenant with this slug
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (tenantError) {
        console.error('Slug tenant lookup error:', tenantError);
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve slug'
        });
      }

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Business not found or is not currently active'
        });
      }

      // Find the active QR code for this tenant
      const { data: qrRecord, error: qrError } = await supabaseAdmin
        .from('qr_codes')
        .select('code')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .maybeSingle();

      if (qrError) {
        console.error('Slug QR lookup error:', qrError);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve QR code'
        });
      }

      if (!qrRecord) {
        return res.status(404).json({
          success: false,
          message: 'No active QR code found for this business'
        });
      }

      return res.status(200).json({
        success: true,
        business_name: tenant.business_name,
        qr_code: qrRecord.code
      });
    } catch (error) {
      console.error('Slug resolution error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error while resolving slug'
      });
    }
  }
);

module.exports = router;
