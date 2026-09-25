const express = require('express');
const crypto = require('crypto');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Get current vendor QR
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

      const { data: qrCode, error } = await supabaseAdmin
        .from('qr_codes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Get QR error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch QR code'
        });
      }

      return res.status(200).json({
        success: true,
        qr_code: qrCode
      });
    } catch (error) {
      console.error('Get QR error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while fetching QR code'
      });
    }
  }
);

// Create QR for current vendor
router.post(
  '/',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'User is not linked to a vendor'
        });
      }

      // Check if an active QR already exists
      const { data: existingQr, error: existingError } =
        await supabaseAdmin
          .from('qr_codes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .maybeSingle();

      if (existingError) {
        console.error('Check existing QR error:', existingError);

        return res.status(500).json({
          success: false,
          message: 'Failed to check existing QR code'
        });
      }

      if (existingQr) {
        return res.status(200).json({
          success: true,
          message: 'Active QR code already exists',
          qr_code: existingQr
        });
      }

      // Generate a random public QR identifier
      const code = crypto.randomBytes(16).toString('hex');

      const { data: qrCode, error } = await supabaseAdmin
        .from('qr_codes')
        .insert({
          tenant_id: tenantId,
          code,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Create QR error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to create QR code'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'QR code created successfully',
        qr_code: qrCode
      });
    } catch (error) {
      console.error('Create QR error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while creating QR code'
      });
    }
  }
);

module.exports = router;