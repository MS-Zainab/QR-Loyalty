const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Create a new vendor/tenant
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { business_name } = req.body;

      if (!business_name || !business_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business name is required'
        });
      }

      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .insert({
          business_name: business_name.trim(),
          status: 'active'
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

      return res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        tenant
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

// Get all vendors/tenants
router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status, created_at, updated_at')
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

// Update vendor status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

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

// Create a vendor owner for a tenant
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

// Create a vendor staff member for a tenant
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

      return res.status(201).json({
        success: true,
        message: 'Vendor staff created successfully',
        staff: profile,
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

module.exports = router;