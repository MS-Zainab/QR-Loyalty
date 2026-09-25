const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Register authenticated customer with a vendor using the vendor QR
router.post(
  '/register',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const { qr_code, phone } = req.body;

      if (!qr_code) {
        return res.status(400).json({
          success: false,
          message: 'QR code is required'
        });
      }

      // Find active vendor QR
      const { data: qrRecord, error: qrError } =
        await supabaseAdmin
          .from('qr_codes')
          .select('id, tenant_id, is_active')
          .eq('code', qr_code)
          .eq('is_active', true)
          .maybeSingle();

      if (qrError) {
        console.error('Customer registration QR error:', qrError);

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
      const profileId = req.profile.id;

      // Check if customer is already registered with this vendor
      const { data: existingCustomer, error: existingError } =
        await supabaseAdmin
          .from('customers')
          .select(
            'id, tenant_id, profile_id, name, phone, email, status'
          )
          .eq('tenant_id', tenantId)
          .eq('profile_id', profileId)
          .maybeSingle();

      if (existingError) {
        console.error(
          'Existing customer lookup error:',
          existingError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to check customer registration'
        });
      }

      if (existingCustomer) {
        return res.status(200).json({
          success: true,
          message: 'Customer is already registered with this vendor',
          customer: existingCustomer
        });
      }

      // Create customer record
      const { data: customer, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .insert({
            tenant_id: tenantId,
            profile_id: profileId,
            name: req.profile.full_name,
            phone: phone || null,
            email: req.user.email || null,
            status: 'active'
          })
          .select(
            'id, tenant_id, profile_id, name, phone, email, status, created_at'
          )
          .single();

      if (customerError) {
        console.error(
          'Customer registration error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to register customer'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Customer registered with vendor successfully',
        customer
      });
    } catch (error) {
      console.error(
        'Customer registration error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Customer registration failed'
      });
    }
  }
);

module.exports = router;