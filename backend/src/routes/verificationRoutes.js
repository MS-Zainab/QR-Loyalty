const express = require('express');
const crypto = require('crypto');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// =====================================================
// Generate a 60-second verification PIN for staff
// =====================================================
router.post(
  '/generate',
  requireAuth,
  requireRole('vendor_staff'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const profileId = req.profile.id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Staff member is not linked to a vendor'
        });
      }

      // Find the operational staff record linked to this profile
      const { data: staffRecord, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('profile_id', profileId)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .maybeSingle();

      if (staffError) {
        console.error('Get staff record error:', staffError);

        return res.status(500).json({
          success: false,
          message: 'Failed to find staff record'
        });
      }

      if (!staffRecord) {
        return res.status(400).json({
          success: false,
          message: 'Active staff record not found'
        });
      }

      const staffId = staffRecord.id;

      // Generate a random 6-digit PIN
      const pin = crypto.randomInt(100000, 1000000).toString();

      // PIN is valid for 60 seconds
      const expiresAt = new Date(
        Date.now() + 60 * 1000
      ).toISOString();

      // Mark previous active PINs for this vendor as used
      const { error: invalidateError } =
        await supabaseAdmin
          .from('verification_codes')
          .update({
            is_used: true
          })
          .eq('tenant_id', tenantId)
          .eq('is_used', false);

      if (invalidateError) {
        console.error(
          'Invalidate previous verification codes error:',
          invalidateError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to prepare verification PIN'
        });
      }

      // Create new PIN
      const { data: verificationCode, error } =
        await supabaseAdmin
          .from('verification_codes')
          .insert({
            tenant_id: tenantId,
            staff_id: staffId,
            code: pin,
            expires_at: expiresAt,
            is_used: false
          })
          .select()
          .single();

      if (error) {
        console.error(
          'Generate verification PIN error:',
          error
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to generate verification PIN'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Verification PIN generated successfully',
        verification: {
          code: verificationCode.code,
          expires_at: verificationCode.expires_at
        }
      });
    } catch (error) {
      console.error(
        'Generate verification PIN error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Server error while generating verification PIN'
      });
    }
  }
);

// =====================================================
// Verify customer using shop QR + staff PIN
// =====================================================
router.post(
  '/verify',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const { qr_code, pin } = req.body;

      if (!qr_code || !pin) {
        return res.status(400).json({
          success: false,
          message: 'QR code and PIN are required'
        });
      }

      // Find active QR and identify the vendor
      const { data: qrRecord, error: qrError } =
        await supabaseAdmin
          .from('qr_codes')
          .select('id, tenant_id, is_active')
          .eq('code', qr_code)
          .eq('is_active', true)
          .maybeSingle();

      if (qrError) {
        console.error('QR lookup error:', qrError);

        return res.status(500).json({
          success: false,
          message: 'Failed to verify QR code'
        });
      }

      if (!qrRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive QR code'
        });
      }

      const tenantId = qrRecord.tenant_id;

      // Find valid unused PIN for this vendor
      const {
        data: verificationCode,
        error: verificationError
      } = await supabaseAdmin
        .from('verification_codes')
        .select(
          'id, tenant_id, staff_id, code, expires_at, is_used'
        )
        .eq('tenant_id', tenantId)
        .eq('code', pin)
        .eq('is_used', false)
        .maybeSingle();

      if (verificationError) {
        console.error(
          'PIN lookup error:',
          verificationError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to verify PIN'
        });
      }

      if (!verificationCode) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or already used PIN'
        });
      }

      // Check PIN expiry
      if (
        new Date(verificationCode.expires_at) <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: 'PIN has expired'
        });
      }

      // Find customer belonging to this vendor
      const {
        data: customer,
        error: customerError
      } = await supabaseAdmin
        .from('customers')
        .select(
          'id, tenant_id, profile_id, name, status'
        )
        .eq('tenant_id', tenantId)
        .eq('profile_id', req.profile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (customerError) {
        console.error(
          'Customer lookup error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to find customer'
        });
      }

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer is not registered with this vendor'
        });
      }

      // Mark PIN as used
      const { error: markUsedError } =
        await supabaseAdmin
          .from('verification_codes')
          .update({
            is_used: true
          })
          .eq('id', verificationCode.id)
          .eq('is_used', false);

      if (markUsedError) {
        console.error(
          'PIN update error:',
          markUsedError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to complete PIN verification'
        });
      }

      // Record customer visit
      const { data: visit, error: visitError } =
        await supabaseAdmin
          .from('visits')
          .insert({
            tenant_id: tenantId,
            customer_id: customer.id,
            staff_id: verificationCode.staff_id
          })
          .select(
            'id, tenant_id, customer_id, staff_id, visited_at'
          )
          .single();

      if (visitError) {
        console.error(
          'Visit creation error:',
          visitError
        );

        return res.status(500).json({
          success: false,
          message:
            'Verification succeeded but visit could not be recorded'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Customer verified successfully',
        verification: {
          tenant_id: tenantId,
          customer_id: customer.id,
          staff_id: verificationCode.staff_id,
          visit_id: visit.id,
          visited_at: visit.visited_at
        }
      });
    } catch (error) {
      console.error(
        'Customer verification error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Customer verification failed'
      });
    }
  }
);

module.exports = router;