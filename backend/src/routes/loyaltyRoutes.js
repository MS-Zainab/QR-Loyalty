const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Get current vendor loyalty program
router.get(
  '/',
  requireAuth,
  requireRole('vendor_owner', 'vendor_staff'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'User is not linked to a vendor'
        });
      }

      const { data: program, error } = await supabaseAdmin
        .from('loyalty_programs')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Get loyalty program error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch loyalty program'
        });
      }

      return res.status(200).json({
        success: true,
        program
      });
    } catch (error) {
      console.error('Get loyalty program error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while fetching loyalty program'
      });
    }
  }
);

// Create or update vendor loyalty program
router.post(
  '/',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const { name, stamps_required } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'User is not linked to a vendor'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Loyalty program name is required'
        });
      }

      if (
        !Number.isInteger(stamps_required) ||
        stamps_required < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'Stamps required must be a positive whole number'
        });
      }

      // Check whether this vendor already has a program
      const { data: existingProgram, error: existingError } =
        await supabaseAdmin
          .from('loyalty_programs')
          .select('id')
          .eq('tenant_id', tenantId)
          .maybeSingle();

      if (existingError) {
        console.error('Check loyalty program error:', existingError);

        return res.status(500).json({
          success: false,
          message: 'Failed to check existing loyalty program'
        });
      }

      let program;
      let error;

      if (existingProgram) {
        const result = await supabaseAdmin
          .from('loyalty_programs')
          .update({
            name: name.trim(),
            stamps_required,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgram.id)
          .select()
          .single();

        program = result.data;
        error = result.error;
      } else {
        const result = await supabaseAdmin
          .from('loyalty_programs')
          .insert({
            tenant_id: tenantId,
            name: name.trim(),
            stamps_required
          })
          .select()
          .single();

        program = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Save loyalty program error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to save loyalty program'
        });
      }

      return res.status(200).json({
        success: true,
        message: existingProgram
          ? 'Loyalty program updated successfully'
          : 'Loyalty program created successfully',
        program
      });
    } catch (error) {
      console.error('Save loyalty program error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while saving loyalty program'
      });
    }
  }
);

module.exports = router;